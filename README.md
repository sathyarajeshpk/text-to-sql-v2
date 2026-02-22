# Text-to-SQL v2: Zero-Cost Natural Language to SQL

Convert natural language to SQL queries using completely free AI services. 
Now with support for databases, CSV, Excel, and pasted table data.

## Features

- **Multiple Input Methods:** Database, CSV, Excel, Paste
- **Unified Schema Layer:** Works with any data source
- **Smart Query Engine:** DuckDB for file-based SQL execution
- **Dual-LLM Validation:** Groq (generate) + Gemini (validate)
- **PWA Ready:** Install as mobile/desktop app

## Quick Start

1. Get free API keys:
   - Groq: https://console.groq.com
   - Gemini: https://ai.google.dev

2. Setup:
   ```bash
   cp .env.template .env
   # Edit .env with your API keys
   docker-compose up --build