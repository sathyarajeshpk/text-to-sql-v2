import React, { useState } from "react";
import axios from "axios";
import ChartView from "./components/ChartView";

const API_URL = "http://localhost:8000";

function App() {

  const [files, setFiles] = useState([]);
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);

  const uploadFiles = async () => {

    const formData = new FormData();

    for (let f of files) {
      formData.append("files", f);
    }

    const res = await axios.post(
      `${API_URL}/api/upload/csv-multi`,
      formData
    );

    setSession(res.data);
  };

  const runQuery = async () => {

    const res = await axios.post(`${API_URL}/api/query`, {
      session_id: session.session_id,
      query: query
    });

    setResult(res.data);
  };

  return (
    <div style={{ padding: 40 }}>

      <h2>Upload CSV Files</h2>

      <input
        type="file"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files))}
      />

      <button onClick={uploadFiles}>
        Upload
      </button>

      {session && (
        <>
          <h3>Ask Query</h3>

          <input
            style={{ width: 400 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button onClick={runQuery}>
            Generate SQL
          </button>
        </>
      )}

      {result && (
        <>
          <h3>SQL</h3>
          <pre>{result.sql}</pre>

          {result.disclaimer && (
            <div style={{ color: "orange" }}>
              {result.disclaimer}
            </div>
          )}

          <h3>Explanation</h3>
          <div>{result.explanation}</div>

          <h3>Result</h3>

          <pre>
            {JSON.stringify(result.execution_result, null, 2)}
          </pre>

          {result.execution_result && (
            <ChartView data={result.execution_result} />
          )}
        </>
      )}

    </div>
  );
}

export default App;