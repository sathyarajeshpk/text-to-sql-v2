import React, { useState } from "react";
import axios from "axios";
import ChartView from "./components/ChartView";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const [files, setFiles] = useState([]);
  const [pasteData, setPasteData] = useState("");
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // ================= DB CONFIG =================

  const [dbConfig, setDbConfig] = useState({
    db_type: "mysql",
    host: "localhost",
    port: 3306,
    database: "",
    username: "",
    password: ""
  });

  // ================= Upload =================

  const uploadFiles = async () => {
    if (!files.length) return alert("Select files");

    const form = new FormData();
    files.forEach((f) => form.append("files", f));

    try {
      setLoading(true);
      const res = await axios.post(`${API}/api/upload/csv-multi`, form);
      setSession(res.data);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // ================= Paste =================

  const uploadPaste = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API}/api/upload/paste`, {
        content: pasteData,
      });
      setSession(res.data);
    } catch (err) {
      console.error(err);
      alert("Paste failed");
    } finally {
      setLoading(false);
    }
  };

  // ================= Database Connect =================

  const connectDB = async () => {
    try {
      setLoading(true);

      const res = await axios.post(`${API}/api/connect/database`, dbConfig);

      if (res.data.error) {
        alert(res.data.error);
      } else {
        setSession(res.data);
      }

    } catch (err) {
      console.error(err);
      alert("Database connection failed");
    } finally {
      setLoading(false);
    }
  };

  // ================= Query =================

  const runQuery = async () => {
    if (!session) return alert("Upload data or connect DB first");

    try {
      setLoading(true);

      const res = await axios.post(`${API}/api/query`, {
        session_id: session.session_id,
        query,
      });

      setResult(res.data);

    } catch (err) {
      console.error(err);
      alert("Query failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <h1 className="text-3xl font-bold mb-6">🚀 AI Text-to-SQL</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("upload")}
          className={`px-4 py-2 rounded ${
            activeTab === "upload" ? "bg-blue-600" : "bg-slate-800"
          }`}
        >
          Upload
        </button>

        <button
          onClick={() => setActiveTab("paste")}
          className={`px-4 py-2 rounded ${
            activeTab === "paste" ? "bg-blue-600" : "bg-slate-800"
          }`}
        >
          Paste
        </button>

        <button
          onClick={() => setActiveTab("database")}
          className={`px-4 py-2 rounded ${
            activeTab === "database" ? "bg-blue-600" : "bg-slate-800"
          }`}
        >
          Database
        </button>
      </div>

      {/* Upload */}
      {activeTab === "upload" && (
        <div className="bg-slate-900 p-6 rounded mb-6">
          <input
            type="file"
            multiple
            onChange={(e) => setFiles([...e.target.files])}
            className="mb-4"
          />

          <button
            onClick={uploadFiles}
            className="bg-green-600 px-4 py-2 rounded"
          >
            {loading ? "Uploading..." : "Upload Files"}
          </button>
        </div>
      )}

      {/* Paste */}
      {activeTab === "paste" && (
        <div className="bg-slate-900 p-6 rounded mb-6">
          <textarea
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            placeholder="Paste CSV / JSON here"
            className="w-full h-40 bg-slate-800 p-3 rounded mb-4"
          />

          <button
            onClick={uploadPaste}
            className="bg-purple-600 px-4 py-2 rounded"
          >
            {loading ? "Processing..." : "Process"}
          </button>
        </div>
      )}

      {/* Database */}
      {activeTab === "database" && (
        <div className="bg-slate-900 p-6 rounded mb-6 space-y-3">

          <div className="grid grid-cols-2 gap-3">

            <input
              className="bg-slate-800 p-2 rounded"
              placeholder="Host"
              value={dbConfig.host}
              onChange={(e) =>
                setDbConfig({ ...dbConfig, host: e.target.value })
              }
            />

            <input
              className="bg-slate-800 p-2 rounded"
              placeholder="Port"
              value={dbConfig.port}
              onChange={(e) =>
                setDbConfig({ ...dbConfig, port: e.target.value })
              }
            />

            <input
              className="bg-slate-800 p-2 rounded"
              placeholder="Database"
              value={dbConfig.database}
              onChange={(e) =>
                setDbConfig({ ...dbConfig, database: e.target.value })
              }
            />

            <input
              className="bg-slate-800 p-2 rounded"
              placeholder="Username"
              value={dbConfig.username}
              onChange={(e) =>
                setDbConfig({ ...dbConfig, username: e.target.value })
              }
            />

            <input
              type="password"
              className="bg-slate-800 p-2 rounded"
              placeholder="Password"
              value={dbConfig.password}
              onChange={(e) =>
                setDbConfig({ ...dbConfig, password: e.target.value })
              }
            />

          </div>

          <button
            onClick={connectDB}
            className="bg-blue-600 px-4 py-2 rounded"
          >
            {loading ? "Connecting..." : "Connect Database"}
          </button>

        </div>
      )}

      {/* Schema */}
      {session && session.schema && (
        <div className="bg-slate-900 p-6 rounded mb-6">
          <h2 className="text-xl mb-4">Schema</h2>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(session.schema).map(([table, cols]) => (
              <div key={table} className="bg-slate-800 p-3 rounded">
                <p className="font-bold text-blue-400">{table}</p>
                <ul className="text-sm text-slate-400">
                  {cols.map((c) => (
                    <li key={c.name}>
                      {c.name} ({c.type})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query */}
      {session && (
        <div className="bg-slate-900 p-6 rounded mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask question..."
            className="w-full bg-slate-800 p-3 rounded mb-4"
          />

          <button
            onClick={runQuery}
            className="bg-blue-600 px-4 py-2 rounded"
          >
            {loading ? "Generating..." : "Generate SQL"}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-slate-900 p-6 rounded">
          <h3 className="mb-2">Generated SQL</h3>

          <pre className="bg-slate-950 p-3 rounded mb-4">
            {result.sql}
          </pre>

          {result.explanation && (
            <div className="mb-4 text-green-400">
              <b>Explanation:</b> {result.explanation}
            </div>
          )}

          {result.disclaimer && (
            <div className="mb-4 text-yellow-400">
              {result.disclaimer}
            </div>
          )}

          {result.execution_result && result.execution_result.length > 0 && (
            <>
              <table className="w-full text-sm mb-6">
                <thead>
                  <tr>
                    {Object.keys(result.execution_result[0] || {}).map((k) => (
                      <th key={k} className="text-left p-2">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {result.execution_result.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="p-2">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <ChartView data={result.execution_result} />
            </>
          )}
        </div>
      )}
    </div>
  );
}