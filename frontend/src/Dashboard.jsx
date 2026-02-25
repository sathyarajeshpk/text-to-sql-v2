import { useEffect, useState } from "react";

export default function Dashboard({ onLogout }) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch(`${import.meta.env.VITE_API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setMessage(JSON.stringify(data));
      })
      .catch(() => {
        setMessage("Failed to load data");
      });
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2>Welcome to Dashboard 🚀</h2>

      <button onClick={onLogout}>Logout</button>

      <pre>{message}</pre>
    </div>
  );
}