import { useState } from "react";

export default function Signup({ onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSignup = async () => {
    try {
      const res = await fetch(
        "https://backend-red-breeze-2741.fly.dev/api/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Signup failed");
        return;
      }

      // Save token
      localStorage.setItem("token", data.token);

      alert("Signup successful!");

      // Notify parent component
      if (onSignup) {
        onSignup(data.token);
      }

    } catch (err) {
      console.error(err);
      alert("Signup failed");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
        background: "#0f172a",
      }}
    >
      <div
        style={{
          background: "white",
          padding: 30,
          borderRadius: 8,
          width: 300,
        }}
      >
        <h2>Signup</h2>

        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: 20 }}
        />

        <button
          onClick={handleSignup}
          style={{
            width: "100%",
            padding: 10,
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Signup
        </button>
      </div>
    </div>
  );
}