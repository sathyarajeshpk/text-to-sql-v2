from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from enum import Enum
import os
import json
import re
import io
import tempfile
import hashlib
from datetime import datetime
import groq
import google.generativeai as genai
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
import pandas as pd
import polars as pl

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MAX_FILE_SIZE = 100 * 1024 * 1024

# Initialize clients
groq_client = groq.Client(api_key=GROQ_API_KEY)
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-2.0-flash-lite')

app = FastAPI(title="ZeroCost Text-to-SQL v2", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_sessions: Dict[str, Any] = {}

class InputType(str, Enum):
    DATABASE = "database"
    CSV = "csv"
    EXCEL = "excel"
    PASTE = "paste"

class DatabaseConnection(BaseModel):
    db_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: str
    username: Optional[str] = None
    password: Optional[str] = None

class PastedTable(BaseModel):
    table_name: str = "pasted_data"
    content: str
    format: str = "auto"
    has_header: bool = True

FORBIDDEN_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 
                      'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE']

def sanitize_sql(sql: str) -> tuple[bool, str]:
    upper_sql = sql.upper()
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in upper_sql:
            return False, f"Forbidden: {keyword}"
    if not upper_sql.strip().startswith('SELECT'):
        return False, "Only SELECT allowed"
    return True, "Safe"

class SchemaExtractor:
    @staticmethod
    def from_csv(file_path: str, table_name: str = "uploaded_csv"):
        try:
            df = pl.read_csv(file_path, infer_schema_length=1000, n_rows=10000)
            schema = {table_name: []}
            for col_name, dtype in zip(df.columns, df.dtypes):
                schema[table_name].append({
                    "name": col_name,
                    "type": str(dtype),
                    "nullable": df[col_name].null_count() > 0
                })
            sample_data = df.head(5).to_pandas().to_dict(orient='records')
            return schema, {
                "file_path": file_path,
                "type": "csv",
                "row_count": df.shape[0],
                "sample_data": sample_data,
                "polars_df": df
            }
        except Exception as e:
            raise ValueError(f"CSV parse error: {str(e)}")

    @staticmethod
    def from_excel(file_path: str):
        try:
            xl = pd.ExcelFile(file_path)
            schema = {}
            metadata = {"file_path": file_path, "type": "excel", "sheets": {}, "pandas_dfs": {}}
            for sheet_name in xl.sheet_names:
                safe_name = re.sub(r'[^\w]', '_', sheet_name).lower()
                df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=10000)
                schema[safe_name] = []
                for col_name, dtype in zip(df.columns, df.dtypes):
                    schema[safe_name].append({
                        "name": str(col_name),
                        "type": str(dtype),
                        "nullable": df[col_name].isna().any()
                    })
                metadata["sheets"][safe_name] = {
                    "original_name": sheet_name,
                    "row_count": len(df),
                    "sample_data": df.head(5).to_dict(orient='records')
                }
                metadata["pandas_dfs"][safe_name] = df
            return schema, metadata
        except Exception as e:
            raise ValueError(f"Excel parse error: {str(e)}")

    @staticmethod
    def from_paste(pasted: PastedTable):
        content = pasted.content.strip()
        if pasted.format == "auto":
            if content.startswith('[') or content.startswith('{'):
                detected_format = "json"
            elif '\t' in content[:1000]:
                detected_format = "tsv"
            else:
                detected_format = "csv"
        else:
            detected_format = pasted.format
        
        try:
            if detected_format == "json":
                data = json.loads(content)
                df = pd.DataFrame(data) if isinstance(data, list) else pd.json_normalize(data)
            elif detected_format == "tsv":
                df = pd.read_csv(io.StringIO(content), sep='\t', header=0 if pasted.has_header else None)
            else:
                df = pd.read_csv(io.StringIO(content), header=0 if pasted.has_header else None)
            
            df.columns = [re.sub(r'[^\w]', '_', str(col)).strip('_') for col in df.columns]
            table_name = re.sub(r'[^\w]', '_', pasted.table_name).lower()
            schema = {table_name: []}
            for col_name, dtype in zip(df.columns, df.dtypes):
                schema[table_name].append({
                    "name": str(col_name),
                    "type": str(dtype),
                    "nullable": df[col_name].isna().any()
                })
            return schema, {
                "type": "paste",
                "format": detected_format,
                "dataframe": df,
                "row_count": len(df),
                "sample_data": df.head(5).to_dict(orient='records')
            }
        except Exception as e:
            raise ValueError(f"Parse error: {str(e)}")

class QueryEngine:
    @staticmethod
    async def execute(session_data: Dict, sql: str):
        source_type = session_data.get("type")
        if source_type in ["csv", "paste"]:
            return QueryEngine._execute_dataframe(session_data, sql)
        elif source_type == "excel":
            return QueryEngine._execute_excel(session_data, sql)
        return None, "Unknown source"

    @staticmethod
    def _execute_dataframe(session_data: Dict, sql: str):
        try:
            import duckdb
            con = duckdb.connect()
            if "polars_df" in session_data:
                df = session_data["polars_df"]
                con.register("data", df)
                result = con.execute(sql.replace("FROM uploaded_csv", "FROM data")).fetchdf()
            elif "dataframe" in session_data:
                df = session_data["dataframe"]
                con.register("data", df)
                result = con.execute(sql.replace("FROM pasted_data", "FROM data")).fetchdf()
            else:
                return None, "No data"
            return result.to_dict(orient='records'), None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def _execute_excel(session_data: Dict, sql: str):
        try:
            import duckdb
            con = duckdb.connect()
            for sheet_name, df in session_data.get("pandas_dfs", {}).items():
                con.register(sheet_name, df)
            result = con.execute(sql).fetchdf()
            return result.to_dict(orient='records'), None
        except Exception as e:
            return None, str(e)

async def generate_sql(natural_query: str, schema: Dict, source_type: str):
    schema_text = json.dumps(schema, indent=2)
    context = ""
    if source_type == "csv":
        context = "Data from CSV. Table: uploaded_csv."
    elif source_type == "excel":
        context = "Data from Excel with multiple sheets."
    elif source_type == "paste":
        context = "Data pasted by user. Table: pasted_data."
    
    prompt = f"""Convert to SQL (SELECT only):
{context}

Schema:
{schema_text}

Query: {natural_query}

Rules:
1. SELECT statements only
2. Use proper JOINs
3. Add LIMIT 100 for large results
4. Use table aliases
5. Quote column names with spaces

SQL:"""

    try:
        response = groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=500
        )
        sql = response.choices[0].message.content.strip()
        sql = re.sub(r'^```sql\s*', '', sql)
        sql = re.sub(r'```\s*$', '', sql)
        return sql.strip()
    except Exception as e:
        raise HTTPException(503, f"Groq error: {str(e)}")

async def validate_sql(sql: str, natural_query: str, schema: Dict):
    schema_text = json.dumps(schema, indent=2)
    prompt = f"""Validate SQL for: "{natural_query}"

Schema: {schema_text}
SQL: {sql}

Respond in JSON:
{{
  "is_valid": true/false,
  "confidence": 0.0-1.0,
  "explanation": "reason",
  "issues": ["list"],
  "suggested_sql": "fix or null"
}}"""
    try:
        response = gemini_model.generate_content(prompt)
        text = response.text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return {"is_valid": False, "confidence": 0, "explanation": "Parse failed"}
    except Exception as e:
        return {"is_valid": False, "confidence": 0, "explanation": str(e)}

@app.post("/api/upload/csv")
async def upload_csv(file: UploadFile = File(...), table_name: Optional[str] = Form("uploaded_csv")):
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Must be CSV")
    
    file_path = os.path.join(tempfile.gettempdir(), f"{datetime.now().timestamp()}_{file.filename}")
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(400, "File too large")
            f.write(content)
        
        schema, metadata = SchemaExtractor.from_csv(file_path, table_name)
        session_id = hashlib.md5(f"csv_{file.filename}_{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        active_sessions[session_id] = {"type": "csv", "schema": schema, "metadata": metadata}
        
        return {
            "session_id": session_id,
            "input_type": "csv",
            "schema": schema,
            "metadata": {"filename": file.filename, "row_count": metadata["row_count"]}
        }
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(400, str(e))

@app.post("/api/upload/excel")
async def upload_excel(file: UploadFile = File(...)):
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(400, "Must be Excel")
    
    file_path = os.path.join(tempfile.gettempdir(), f"{datetime.now().timestamp()}_{file.filename}")
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(400, "File too large")
            f.write(content)
        
        schema, metadata = SchemaExtractor.from_excel(file_path)
        session_id = hashlib.md5(f"excel_{file.filename}_{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        active_sessions[session_id] = {"type": "excel", "schema": schema, "metadata": metadata}
        
        return {
            "session_id": session_id,
            "input_type": "excel",
            "schema": schema,
            "metadata": {"filename": file.filename, "sheets": list(schema.keys())}
        }
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(400, str(e))

@app.post("/api/paste/table")
async def paste_table(pasted: PastedTable):
    try:
        schema, metadata = SchemaExtractor.from_paste(pasted)
        session_id = hashlib.md5(f"paste_{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        active_sessions[session_id] = {"type": "paste", "schema": schema, "metadata": metadata}
        
        return {
            "session_id": session_id,
            "input_type": "paste",
            "schema": schema,
            "metadata": {"format": metadata["format"], "row_count": metadata["row_count"]}
        }
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/query")
async def process_query(query_req: dict):
    session_id = query_req.get("session_id")
    if session_id not in active_sessions:
        raise HTTPException(404, "Session not found")
    
    session = active_sessions[session_id]
    schema = session["schema"]
    source_type = session["type"]
    natural_query = query_req.get("query")
    
    generated_sql = await generate_sql(natural_query, schema, source_type)
    validation = await validate_sql(generated_sql, natural_query, schema)
    
    execution_result = None
    execution_error = None
    
    if validation.get("is_valid", False):
        final_sql = validation.get("suggested_sql") or generated_sql
        is_safe, msg = sanitize_sql(final_sql)
        if is_safe:
            execution_result, execution_error = await QueryEngine.execute(session["metadata"], final_sql)
        else:
            execution_error = msg
        generated_sql = final_sql
    
    return {
        "sql": generated_sql,
        "is_valid": validation.get("is_valid", False),
        "confidence": validation.get("confidence", 0),
        "explanation": validation.get("explanation"),
        "execution_result": execution_result,
        "execution_error": execution_error
    }

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "sessions": len(active_sessions)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)