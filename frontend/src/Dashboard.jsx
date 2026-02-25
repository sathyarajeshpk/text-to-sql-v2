import { useState } from "react";
import {
  connectDatabase,
  uploadCSV,
  runQuery
} from "./api";

export default function Dashboard({ onLogout }) {
  const [tab, setTab] = useState("database");
  const [sessionId, setSessionId] = useState(null);
  const [schema, setSchema] = useState(null);

  const [dbConfig, setDbConfig] = useState({
    host: "",
    port: "",
    database: "",
    user: "",
    password: ""
  });

  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [sql, setSQL] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // ---------- CONNECT DB ----------

  const handleConnectDB = async () => {
    try {
      const res = await connectDatabase(dbConfig);

      if (res.session_id) setSessionId(res.session_id);
      if (res.schema) setSchema(res.schema);

      setResult(res);
    } catch (err) {
      alert("Database connection failed");
    }
  };

  // ---------- UPLOAD ----------

  const handleUpload = async (e) => {
    try {
      const files = e.target.files;
      if (!files.length) return;

      const res = await uploadCSV(files);

      if (res.session_id) setSessionId(res.session_id);
      if (res.schema) setSchema(res.schema);

      setResult(res);
    } catch (err) {
      alert("Upload failed");
    }
  };

  // ---------- QUERY ----------

  const handleQuery = async () => {
    if (!sessionId) {
      alert("Connect DB or Upload first");
      return;
    }

    setLoading(true);

    const res = await runQuery({
      question,
      session_id: sessionId
    });

    setLoading(false);

    setResult(res);
    setSQL(res?.sql || "");

    setHistory([
      { question, sql: res?.sql || "", time: new Date().toLocaleTimeString() },
      ...history
    ]);
  };

  // ---------- TABLE ----------

  const renderTable = () => {
    if (!result?.data || !Array.isArray(result.data)) return null;

    const rows = result.data;
    if (!rows.length) return <div>No data</div>;

    const cols = Object.keys(rows[0]);

    return (
      <table className="table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{r[c]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ---------- SCHEMA ----------

  const renderSchema = () => {
    if (!schema) return <div>No schema loaded</div>;

    return Object.entries(schema).map(([table, cols]) => (
      <div key={table} className="schemaCard">
        <b>{table}</b>
        {Array.isArray(cols) &&
          cols.map((c, i) => <div key={i}>{c}</div>)}
      </div>
    ));
  };

  return (
    <div className="page">
      {/* HEADER */}
      <div className="header">
        <h2>🚀 ZeroCost Text-to-SQL</h2>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div className="layout">
        {/* LEFT */}
        <div>
          <div className="tabs">
            <button onClick={() => setTab("database")}>Database</button>
            <button onClick={() => setTab("upload")}>Upload</button>
          </div>

          {tab === "database" && (
            <div className="card">
              <input
                placeholder="Host"
                value={dbConfig.host}
                onChange={(e) =>
                  setDbConfig({ ...dbConfig, host: e.target.value })
                }
              />
              <input
                placeholder="Port"
                value={dbConfig.port}
                onChange={(e) =>
                  setDbConfig({ ...dbConfig, port: e.target.value })
                }
              />
              <input
                placeholder="Database"
                value={dbConfig.database}
                onChange={(e) =>
                  setDbConfig({ ...dbConfig, database: e.target.value })
                }
              />
              <input
                placeholder="User"
                value={dbConfig.user}
                onChange={(e) =>
                  setDbConfig({ ...dbConfig, user: e.target.value })
                }
              />
              <input
                type="password"
                placeholder="Password"
                value={dbConfig.password}
                onChange={(e) =>
                  setDbConfig({ ...dbConfig, password: e.target.value })
                }
              />

              <button onClick={handleConnectDB}>
                Connect Database
              </button>
            </div>
          )}

          {tab === "upload" && (
            <div className="card">
              <input type="file" multiple onChange={handleUpload} />
            </div>
          )}

          <div className="card">
            <textarea
              rows={4}
              placeholder="Ask your question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            <button onClick={handleQuery}>
              {loading ? "Running..." : "Run Query"}
            </button>
          </div>

          {sql && (
            <div className="card">
              <h4>Generated SQL</h4>
              <pre>{sql}</pre>
            </div>
          )}

          <div className="card">{renderTable()}</div>
        </div>

        {/* RIGHT */}
        <div>
          <div className="card">
            <h4>Schema</h4>
            {renderSchema()}
          </div>

          <div className="card">
            <h4>History</h4>
            {history.map((h, i) => (
              <div key={i} className="historyItem">
                {h.question}
                <small>{h.time}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}