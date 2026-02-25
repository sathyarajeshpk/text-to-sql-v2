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

  // ---------- CONNECT DATABASE ----------

  const handleConnectDB = async () => {
    const res = await connectDatabase(dbConfig);

    setSessionId(res.session_id);
    setSchema(res.schema);
    setResult(res);
  };

  // ---------- UPLOAD ----------

  const handleUpload = async (e) => {
    const res = await uploadCSV(e.target.files);

    setSessionId(res.session_id);
    setSchema(res.schema);
    setResult(res);
  };

  // ---------- QUERY ----------

  const handleQuery = async () => {
    if (!sessionId) {
      alert("Connect DB or Upload files first");
      return;
    }

    setLoading(true);

    const res = await runQuery({
      question,
      session_id: sessionId
    });

    setLoading(false);

    setResult(res);
    setSQL(res.sql || "");

    setHistory([
      { question, sql: res.sql, time: new Date().toLocaleTimeString() },
      ...history
    ]);
  };

  // ---------- RESULT TABLE ----------

  const renderTable = () => {
    if (!result || !result.data) return null;

    const rows = result.data;
    const cols = Object.keys(rows[0] || {});

    return (
      <table style={styles.table}>
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

  // ---------- SCHEMA VIEW ----------

  const renderSchema = () => {
    if (!schema) return null;

    return (
      <div style={styles.schemaContainer}>
        {Object.entries(schema).map(([table, cols]) => (
          <div key={table} style={styles.schemaCard}>
            <h4>{table}</h4>
            {cols.map((c, i) => (
              <div key={i}>{c}</div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={styles.page}>
      {/* ---------- HEADER ---------- */}

      <div style={styles.header}>
        <h2>🚀 AI Text-to-SQL</h2>
        <button onClick={onLogout}>Logout</button>
      </div>

      {/* ---------- MAIN ---------- */}

      <div style={styles.layout}>
        {/* ---------- LEFT PANEL ---------- */}

        <div style={styles.left}>
          <div style={styles.tabs}>
            <button onClick={() => setTab("upload")}>Upload</button>
            <button onClick={() => setTab("database")}>Database</button>
          </div>

          {tab === "database" && (
            <div style={styles.card}>
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
            <div style={styles.card}>
              <input type="file" multiple onChange={handleUpload} />
            </div>
          )}

          <div style={styles.card}>
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
            <div style={styles.card}>
              <h4>Generated SQL</h4>
              <pre>{sql}</pre>
            </div>
          )}

          {renderTable()}
        </div>

        {/* ---------- RIGHT PANEL ---------- */}

        <div style={styles.right}>
          <div style={styles.card}>
            <h4>Schema</h4>
            {renderSchema()}
          </div>

          <div style={styles.card}>
            <h4>History</h4>
            {history.map((h, i) => (
              <div key={i} style={styles.historyItem}>
                <div>{h.question}</div>
                <small>{h.time}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- STYLES ----------

const styles = {
  page: {
    background: "#0b1220",
    minHeight: "100vh",
    color: "white",
    padding: 20
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 20
  },

  left: {},

  right: {},

  tabs: {
    display: "flex",
    gap: 10,
    marginBottom: 10
  },

  card: {
    background: "#111827",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    display: "flex",
    flexDirection: "column",
    gap: 8
  },

  schemaContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10
  },

  schemaCard: {
    background: "#1f2937",
    padding: 10,
    borderRadius: 6,
    minWidth: 150
  },

  historyItem: {
    background: "#1f2937",
    padding: 8,
    marginBottom: 6,
    borderRadius: 6
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 10
  }
};