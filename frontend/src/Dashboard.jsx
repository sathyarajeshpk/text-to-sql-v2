import { useState } from "react";
import {
  connectDatabase,
  uploadCSV,
  runQuery
} from "./api";

export default function Dashboard({ onLogout }) {
  const [tab, setTab] = useState("database");
  const [sessionId, setSessionId] = useState(null);

  const [dbConfig, setDbConfig] = useState({
    host: "",
    port: "",
    database: "",
    user: "",
    password: ""
  });

  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---------- CONNECT DB ----------

  const handleConnectDB = async () => {
    const res = await connectDatabase(dbConfig);
    setSessionId(res.session_id);
    setResult(res);
  };

  // ---------- UPLOAD CSV ----------

  const handleUpload = async (e) => {
    const res = await uploadCSV(e.target.files);
    setSessionId(res.session_id);
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

    setResult(res);
    setLoading(false);
  };

  return (
    <div style={{ padding: 30, color: "white" }}>
      <h2>🚀 AI Text-to-SQL</h2>

      <button onClick={onLogout}>Logout</button>

      {/* ---------- TABS ---------- */}

      <div style={{ marginTop: 20 }}>
        <button onClick={() => setTab("upload")}>Upload</button>
        <button onClick={() => setTab("database")}>Database</button>
      </div>

      {/* ---------- DATABASE ---------- */}

      {tab === "database" && (
        <div style={{ marginTop: 20 }}>
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
            placeholder="Password"
            type="password"
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

      {/* ---------- UPLOAD ---------- */}

      {tab === "upload" && (
        <div style={{ marginTop: 20 }}>
          <input type="file" multiple onChange={handleUpload} />
        </div>
      )}

      {/* ---------- QUERY ---------- */}

      <div style={{ marginTop: 30 }}>
        <textarea
          placeholder="Ask your question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          style={{ width: "100%" }}
        />

        <button onClick={handleQuery}>
          {loading ? "Running..." : "Run Query"}
        </button>
      </div>

      {/* ---------- RESULT ---------- */}

      {result && (
        <pre
          style={{
            background: "#111",
            padding: 15,
            marginTop: 20
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}