from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
import tempfile, os, hashlib
import polars as pl
import duckdb
from datetime import datetime

# =========================
# AUTH IMPORTS
# =========================

from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import models, auth

# =========================
# APP INIT
# =========================

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# DB DEPENDENCY
# =========================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


active_sessions: Dict[str, Any] = {}

# =========================
# AUTH APIs
# =========================

@app.post("/api/signup")
def signup(data: Dict, db: Session = Depends(get_db)):

    email = data.get("email")
    password = data.get("password")
    name = data.get("name")

    if not email or not password:
        raise HTTPException(400, "Email and password required")

    existing = db.query(models.User).filter(models.User.email == email).first()

    if existing:
        raise HTTPException(400, "User already exists")

    hashed_pw = auth.hash_password(password)

    user = models.User(
        email=email,
        name=name,
        password_hash=hashed_pw
    )

    db.add(user)
    db.commit()

    token = auth.create_token(email)

    return {"access_token": token}


@app.post("/api/login")
def login(data: Dict, db: Session = Depends(get_db)):

    email = data.get("email")
    password = data.get("password")

    user = db.query(models.User).filter(models.User.email == email).first()

    if not user or not auth.verify_password(password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    token = auth.create_token(email)

    return {"access_token": token}


# =========================
# SAFE SQL CHECK
# =========================

FORBIDDEN = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"]


def is_dangerous(sql: str):
    if not sql:
        return False

    sql_upper = sql.upper()
    return any(keyword in sql_upper for keyword in FORBIDDEN)


# =========================
# COLUMN MATCH HELPER
# =========================

def find_best_column(user_query, columns):

    user_query_lower = user_query.lower()

    for col in columns:
        if col.lower() in user_query_lower:
            return col

    for col in columns:
        if any(word in col.lower() for word in user_query_lower.split()):
            return col

    return None


# =========================
# SIMPLE AI SQL GENERATOR
# =========================

def generate_sql(user_query: str, tables: Dict[str, pl.DataFrame]):

    user_query_lower = user_query.lower()

    table_names = list(tables.keys())
    table = table_names[0]

    df = tables[table]
    columns = df.columns

    if "count" in user_query_lower or "how many" in user_query_lower:
        return f"SELECT COUNT(*) as count FROM {table}"

    for col in columns:
        if col.lower() in user_query_lower:
            return f"SELECT {col} FROM {table} LIMIT 100"

    if "top" in user_query_lower or "first" in user_query_lower:
        return f"SELECT * FROM {table} LIMIT 10"

    return f"SELECT * FROM {table} LIMIT 100"


# =========================
# MULTI CSV UPLOAD (PROTECTED)
# =========================

@app.post("/api/upload/csv-multi")
async def upload_csv_multi(
    files: List[UploadFile] = File(...),
    user_email: str = Depends(auth.verify_token)
):

    schema = {}
    tables = {}

    for file in files:

        path = os.path.join(tempfile.gettempdir(), file.filename)

        with open(path, "wb") as f:
            f.write(await file.read())

        df = pl.read_csv(path)

        table_name = os.path.splitext(file.filename)[0]

        tables[table_name] = df

        schema[table_name] = [
            {
                "name": col,
                "type": str(dtype),
                "nullable": df[col].null_count() > 0,
            }
            for col, dtype in zip(df.columns, df.dtypes)
        ]

    session_id = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12]

    active_sessions[session_id] = {
        "tables": tables,
        "schema": schema,
    }

    return {
        "session_id": session_id,
        "schema": schema,
    }


# =========================
# QUERY (PROTECTED)
# =========================

@app.post("/api/query")
async def query(
    req: Dict,
    user_email: str = Depends(auth.verify_token)
):

    session_id = req.get("session_id")
    user_query = req.get("question")

    if not session_id or session_id not in active_sessions:
        raise HTTPException(404, "Session not found")

    if not user_query:
        raise HTTPException(400, "Question is required")

    session = active_sessions[session_id]
    tables = session["tables"]

    sql = generate_sql(user_query, tables)

    if is_dangerous(sql):
        return {
            "sql": sql,
            "execution_result": None,
            "disclaimer": "⚠️ Dangerous query detected. Execution skipped."
        }

    try:

        con = duckdb.connect()

        for name, df in tables.items():
            con.register(name, df)

        result = con.execute(sql).fetchdf()
        data = result.to_dict(orient="records")

        return {
            "sql": sql,
            "execution_result": data,
            "disclaimer": None,
        }

    except Exception as e:

        return {
            "sql": sql,
            "execution_result": None,
            "error": str(e),
        }


# =========================
# HEALTH
# =========================

@app.get("/api/health")
def health():
    return {"status": "ok"}