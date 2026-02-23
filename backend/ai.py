import os
import json
import groq
import google.generativeai as genai

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

groq_client = groq.Client(api_key=GROQ_API_KEY)

genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash-lite")

async def generate_sql(question: str, schema: dict):

```
prompt = f"""
```

You are an expert SQL generator.

Schema:
{json.dumps(schema, indent=2)}

Rules:

* Use correct table names
* Detect joins automatically using same column names
* Use DuckDB compatible SQL
* Only SELECT queries

Question:
{question}
"""

````
try:
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )

    sql = response.choices[0].message.content

except Exception:
    gemini_response = gemini_model.generate_content(prompt)
    sql = gemini_response.text

sql = sql.replace("```sql", "").replace("```", "").strip()

return sql
````

async def explain_sql(sql: str):

```
prompt = f"Explain this SQL in simple English:\n{sql}"

try:
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )

    return response.choices[0].message.content

except Exception:
    gemini_response = gemini_model.generate_content(prompt)
    return gemini_response.text
```
