from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
import tempfile, os, hashlib, re, json
import polars as pl
import duckdb
from datetime import datetime

# AI
import groq
import google.generativeai as genai

# DB
import psycopg2
import mysql.connector


# ========================
# CONFIG
# ========================

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

groq_client = groq.Client(api_key=GROQ_API_KEY)

genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-1.5-flash")


# ========================
# APP
# ========================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_sessions: Dict[str, Any] = {}

FORBIDDEN = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"]


# ========================
# UTILS
# ========================

def clean_columns(df: pl.DataFrame):
    cols = []
    for c in df.columns:
        new_c = (
            c.lower()
            .replace(" ", "_")
            .replace("(", "")
            .replace(")", "")
            .replace("-", "_")
        )
        cols.append(new_c)
    df.columns = cols
    return df


def is_dangerous(sql: str):
    upper = sql.upper()
    return any(k in upper for k in FORBIDDEN)


def fix_sql(sql: str):

    # remove markdown
    sql = re.sub(r"```sql", "", sql, flags=re.IGNORECASE)
    sql = re.sub(r"```", "", sql)

    # fix MAX col → MAX(col)
    funcs = ["MAX", "MIN", "SUM", "AVG", "COUNT"]

    for fn in funcs:
        sql = re.sub(
            rf"{fn}\s+([a-zA-Z_][a-zA-Z0-9_]*)",
            rf"{fn}(\1)",
            sql,
            flags=re.IGNORECASE,
        )

    return sql.strip()


def detect_join(schema):

    tables = list(schema.keys())

    if len(tables) < 2:
        return ""

    joins = []

    for i in range(len(tables)):
        for j in range(i + 1, len(tables)):

            cols1 = [c["name"] for c in schema[tables[i]]]
            cols2 = [c["name"] for c in schema[tables[j]]]

            common = set(cols1).intersection(cols2)

            for col in common:
                if col.endswith("_id"):
                    joins.append(
                        f"{tables[i]}.{col} = {tables[j]}.{col}"
                    )

    return ", ".join(joins)


# ========================
# AI SQL GENERATION
# ========================

def ai_generate_sql(user_query: str, schema: Dict):

    schema_text = json.dumps(schema, indent=2)

    join_hint = detect_join(schema)

    prompt = f"""
You are an expert SQL engineer.

Generate SQL for the user query.

Schema:
{schema_text}

Join hints:
{join_hint}

Rules:
- SELECT only
- Use proper joins
- Limit 100 rows
- Use table aliases

User Query:
{user_query}

SQL:
"""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=400,
        )

        sql = response.choices[0].message.content

    except Exception:

        gemini = gemini_model.generate_content(prompt)
        sql = gemini.text

    return fix_sql(sql)


def ai_explain(sql: str):

    prompt = f"""
Explain this SQL in simple English:

{sql}
"""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
        )

        return response.choices[0].message.content

    except Exception:

        gemini = gemini_model.generate_content(prompt)
        return gemini.text


def ai_optimize(sql: str):

    prompt = f"""
Rewrite this SQL to be more efficient but keep logic same:

{sql}
"""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
        )

        optimized = response.choices[0].message.content

    except Exception:

        gemini = gemini_model.generate_content(prompt)
        optimized = gemini.text

    return fix_sql(optimized)


# ========================
# CSV MULTI UPLOAD
# ========================

@app.post("/api/upload/csv-multi")
async def upload_csv_multi(files: List[UploadFile] = File(...)):

    schema = {}
    tables = {}

    for file in files:

        path = os.path.join(tempfile.gettempdir(), file.filename)

        with open(path, "wb") as f:
            f.write(await file.read())

        df = pl.read_csv(path)
        df = clean_columns(df)

        table_name = os.path.splitext(file.filename)[0].lower()

        tables[table_name] = df

        schema[table_name] = [
            {"name": c, "type": str(t)}
            for c, t in zip(df.columns, df.dtypes)
        ]

    session_id = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12]

    active_sessions[session_id] = {
        "type": "csv",
        "tables": tables,
        "schema": schema,
    }

    return {"session_id": session_id, "schema": schema}


# ========================
# DATABASE CONNECT
# ========================

@app.post("/api/connect/postgres")
async def connect_postgres(req: Dict):

    conn = psycopg2.connect(
        host=req["host"],
        port=req["port"],
        database=req["database"],
        user=req["user"],
        password=req["password"],
    )

    cur = conn.cursor()

    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='public'
    """)

    tables = [t[0] for t in cur.fetchall()]
    schema = {}

    for t in tables:
        cur.execute(f"""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name='{t}'
        """)

        schema[t] = [
            {"name": c[0], "type": c[1]}
            for c in cur.fetchall()
        ]

    session_id = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12]

    active_sessions[session_id] = {
        "type": "postgres",
        "conn": conn,
        "schema": schema,
    }

    return {"session_id": session_id, "schema": schema}


@app.post("/api/connect/mysql")
async def connect_mysql(req: Dict):

    conn = mysql.connector.connect(
        host=req["host"],
        port=req["port"],
        database=req["database"],
        user=req["user"],
        password=req["password"],
    )

    cursor = conn.cursor()

    cursor.execute("SHOW TABLES")

    tables = [t[0] for t in cursor.fetchall()]
    schema = {}

    for t in tables:
        cursor.execute(f"DESCRIBE {t}")

        schema[t] = [
            {"name": c[0], "type": c[1]}
            for c in cursor.fetchall()
        ]

    session_id = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12]

    active_sessions[session_id] = {
        "type": "mysql",
        "conn": conn,
        "schema": schema,
    }

    return {"session_id": session_id, "schema": schema}


# ========================
# QUERY
# ========================

@app.post("/api/query")
async def query(req: Dict):

    session_id = req.get("session_id")
    user_query = req.get("query")

    if session_id not in active_sessions:
        raise HTTPException(404, "Session not found")

    session = active_sessions[session_id]
    schema = session["schema"]

    sql = ai_generate_sql(user_query, schema)
    optimized_sql = ai_optimize(sql)

    explanation = ai_explain(optimized_sql)

    if is_dangerous(optimized_sql):

        return {
            "sql": optimized_sql,
            "execution_result": None,
            "disclaimer": "Dangerous query detected. Execution skipped.",
            "explanation": explanation,
        }

    # ================= EXECUTE
    if session["type"] == "csv":

        con = duckdb.connect()

        for name, df in session["tables"].items():
            con.register(name, df.to_pandas())

        result = con.execute(optimized_sql).fetchdf().to_dict(
            orient="records"
        )

    elif session["type"] in ["postgres", "mysql"]:

        cursor = session["conn"].cursor()
        cursor.execute(optimized_sql)

        cols = [c[0] for c in cursor.description]
        rows = cursor.fetchall()

        result = [dict(zip(cols, r)) for r in rows]

    else:
        result = []

    return {
        "sql": optimized_sql,
        "execution_result": result,
        "explanation": explanation,
        "disclaimer": None,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}