from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq
import os

from typing import List
import pandas as pd
import uuid
import json
import re

from pandasql import sqldf
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
import models, auth


# ================= LOAD ENV =================

load_dotenv()

app = FastAPI()

Base.metadata.create_all(bind=engine)


# ================= CORS =================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= DB DEPENDENCY =================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================= AI CLIENT FUNCTION =================

def get_ai_client():
    groq_key = os.getenv("GROQ_API_KEY")

    if not groq_key:
        print("❌ GROQ_API_KEY not found in environment")
        return None

    try:
        client = Groq(api_key=groq_key)
        return client
    except Exception as e:
        print("❌ Groq initialization failed:", e)
        return None


# ================= SESSION STORAGE =================

sessions = {}


# ================= HOME =================

@app.get("/")
def home():
    return {"message": "API Running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ================= AUTH =================

@app.post("/api/signup")
def signup(data: dict):

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        raise HTTPException(400, "Email and password required")

    db = SessionLocal()

    existing = db.query(models.User).filter(models.User.email == email).first()

    if existing:
        raise HTTPException(400, "User already exists")

    hashed_pw = auth.hash_password(str(password))

    user = models.User(
        email=email,
        password_hash=hashed_pw
    )

    db.add(user)
    db.commit()
    db.close()

    token = auth.create_token(email)

    return {
        "message": "User created",
        "token": token
    }


@app.post("/api/login")
def login(data: dict, db: Session = Depends(get_db)):

    email = data.get("email")
    password = data.get("password")

    user = db.query(models.User).filter(models.User.email == email).first()

    if not user or not auth.verify_password(password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    token = auth.create_token(email)

    return {"access_token": token}


# ================= CSV UPLOAD =================

@app.post("/api/upload/csv-multi")
async def upload_csv_multi(files: List[UploadFile] = File(...)):

    session_id = str(uuid.uuid4())
    schema = {}
    dataframes = {}

    for file in files:
        df = pd.read_csv(file.file)

        table_name = file.filename.split(".")[0]

        schema[table_name] = [
            {"name": col, "type": str(df[col].dtype)}
            for col in df.columns
        ]

        dataframes[table_name] = df

    sessions[session_id] = {
        "schema": schema,
        "dataframes": dataframes,
        "mode": "csv"
    }

    return {
        "session_id": session_id,
        "schema": schema
    }


# ================= DATABASE CONNECT =================

@app.post("/api/connect/database")
def connect_database(config: dict):

    db_type = config.get("db_type")
    host = config.get("host")
    port = config.get("port")
    database = config.get("database")
    username = config.get("username")
    password = config.get("password")

    try:

        if db_type == "mysql":
            url = f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}"

        elif db_type == "postgresql":
            url = f"postgresql://{username}:{password}@{host}:{port}/{database}"

        else:
            return {"error": "Unsupported database"}

        engine_db = create_engine(url)
        inspector = inspect(engine_db)

        schema = {}

        for table_name in inspector.get_table_names():
            columns = inspector.get_columns(table_name)

            schema[table_name] = [
                {"name": col["name"], "type": str(col["type"])}
                for col in columns
            ]

        session_id = str(uuid.uuid4())

        sessions[session_id] = {
            "schema": schema,
            "engine": engine_db,
            "mode": "database"
        }

        return {
            "session_id": session_id,
            "schema": schema
        }

    except Exception as e:
        return {"error": str(e)}


# ================= QUERY =================

@app.post("/api/query")
def run_query(data: dict):

    session_id = data.get("session_id")
    question = data.get("query")

    session = sessions.get(session_id)

    if not session:
        return {"error": "Invalid session"}

    schema = session.get("schema")

    client = get_ai_client()

    if not client:
        return {"error": "AI client not configured — check GROQ_API_KEY"}

    prompt = f"""
You are an expert data analyst.

Database schema:
{schema}

User question:
{question}

Return ONLY valid JSON:

{{
  "sql": "...",
  "explanation": "...",
  "chart": "bar"
}}
"""

    completion = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    content = completion.choices[0].message.content

    # ---------- Extract JSON ----------

    try:
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        json_str = json_match.group()
        parsed = json.loads(json_str)

        sql = parsed.get("sql")
        explanation = parsed.get("explanation")
        chart_type = parsed.get("chart", "table")

    except Exception as e:
        return {"error": f"AI parsing failed: {str(e)}", "raw": content}

    # ---------- Allow only SELECT ----------

    if not sql.strip().lower().startswith("select"):
        return {
            "sql": sql,
            "explanation": explanation,
            "chart": chart_type,
            "disclaimer": "Only SELECT queries supported",
            "execution_result": [{"message": "Only SELECT allowed"}]
        }

    # ---------- Execute Query ----------

    try:

        if session.get("mode") == "database":

            engine_db = session.get("engine")

            with engine_db.connect() as conn:
                result = conn.execute(text(sql))
                rows = result.fetchall()
                columns = result.keys()

            execution_result = [
                dict(zip(columns, row))
                for row in rows
            ]

        else:

            tables = session.get("dataframes")
            result_df = sqldf(sql, tables)
            execution_result = result_df.to_dict(orient="records")

    except Exception as e:
        execution_result = [{"error": str(e)}]

    return {
        "sql": sql,
        "explanation": explanation,
        "chart": chart_type,
        "execution_result": execution_result
    }