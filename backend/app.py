from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq
import os

from typing import List
import pandas as pd
import uuid
import os
import json
import re

from pandasql import sqldf
from sqlalchemy import create_engine, inspect, text


# ================= LOAD ENV =================

load_dotenv()

app = FastAPI()

# ================= CORS =================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= AI CLIENT =================

client = None
groq_key = os.getenv("GROQ_API_KEY")

# ================= SESSION STORAGE =================

sessions = {}

# ================= HOME =================

@app.get("/")
def home():
    return {"message": "API Running"}


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

        engine = create_engine(url)

        inspector = inspect(engine)

        schema = {}

        for table_name in inspector.get_table_names():

            columns = inspector.get_columns(table_name)

            schema[table_name] = [
                {
                    "name": col["name"],
                    "type": str(col["type"])
                }
                for col in columns
            ]

        session_id = str(uuid.uuid4())

        sessions[session_id] = {
            "schema": schema,
            "engine": engine,
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
        model="llama-3.1-8b-instant",
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
            "disclaimer": "Only SELECT queries supported in demo",
            "execution_result": [
                {"message": "Data modification queries are not supported."}
            ]
        }

    # ---------- Execute Query ----------

    try:

        if session.get("mode") == "database":

            engine = session.get("engine")

            with engine.connect() as conn:
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
        "disclaimer": "Verify before production",
        "execution_result": execution_result
    }