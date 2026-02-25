import { useState } from "react";

export default function Dashboard({ onLogout }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    const token = localStorage.getItem("token");

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question }),
        }
      );

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: "Failed to fetch" });
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 40, maxWidth: 900 }}>
      <h2>ZeroCost Text-to-SQL 🚀</h2>

      <button onClick={onLogout} style={{ marginBottom: 20 }}>
        Logout
      </button>

      <div style={{ marginBottom: 20 }}>
        <textarea
          placeholder="Ask your question... (e.g. Show top 10 customers)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <button onClick={runQuery} disabled={loading}>
        {loading ? "Running..." : "Run Query"}
      </button>

      {result && (
        <div style={{ marginTop: 30 }}>
          <h3>Result</h3>
          <pre
            style={{
              background: "#111",
              padding: 15,
              borderRadius: 8,
              overflow: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}