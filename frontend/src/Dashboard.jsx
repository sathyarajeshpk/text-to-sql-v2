import { useState } from "react";
import { connectDatabase, uploadCSV, runQuery } from "./api";

export default function Dashboard({ onLogout }) {
  const [tab, setTab] = useState("database");
  const [sessionId, setSessionId] = useState(null);
  const [schema, setSchema] = useState({});
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [sql, setSQL] = useState("");
  const [loading, setLoading] = useState(false);

  const [dbConfig, setDbConfig] = useState({
    host: "",
    port: "",
    database: "",
    user: "",
    password: "",
  });

  // ---------- CONNECT DATABASE ----------

  const handleConnectDB = async () => {
    try {
      const res = await connectDatabase(dbConfig);

      console.log("DB RESPONSE:", res);

      setSessionId(res?.session_id || null);
      setSchema(res?.schema || res?.tables || {});
      setResult(res);
    } catch (err) {
      console.error(err);
      alert("DB connection failed");
    }
  };

  // ---------- UPLOAD ----------

  const handleUpload = async (e) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const res = await uploadCSV(files);

      console.log("UPLOAD RESPONSE:", res);

      setSessionId(res?.session_id || null);
      setSchema(res?.schema || res?.tables || {});
      setResult(res);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };

  // ---------- QUERY ----------

  const handleQuery = async () => {
    if (!sessionId) {
      alert("Upload or connect DB first");
      return;
    }

    setLoading(true);

    try {
      const res = await runQuery({
        question,
        session_id: sessionId,
      });

      console.log("QUERY RESPONSE:", res);

      setResult(res);
      setSQL(res?.sql || "");
    } catch (err) {
      console.error(err);
      alert("Query failed");
    }

    setLoading(false);
  };

  // ---------- RESULT TABLE ----------

  const renderTable = () => {
    if (!result?.data || !Array.isArray(result.data)) {
      return <div>No result</div>;
    }

    if (result.data.length === 0) return <div>No rows</div>;

    const cols = Object.keys(result.data[0]);

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
          {result.data.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{String(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ---------- SCHEMA ----------

  const renderSchema = () => {
    if (!schema || typeof schema !== "object") {
      return <div>No schema</div>;
    }

    return Object.keys(schema).map((table) => {
      const cols = schema[table];

      return (
        <div key={table} className="schemaCard">
          <b>{table}</b>

          {Array.isArray(cols) &&
            cols.map((c, i) => <div key={i}>{String(c)}</div>)}
        </div>
      );
    });
  };

  return (
    <div className="page">
      <div className="header">
        <h2>🚀 AI Text-to-SQL</h2>
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
              placeholder="Ask a question..."
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
            <h4>Raw Response</h4>
            <pre>
              {result
                ? JSON.stringify(result, null, 2)
                : "No response"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}