import { useState } from "react";
import { login } from "./api";

export default function Login({ onLogin, switchSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const res = await login({ email, password });

    if (res.access_token) {
      localStorage.setItem("token", res.access_token);
      onLogin();
    } else {
      alert("Login failed");
    }
  };

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 400, margin: "auto" }}>
        <h2>Login</h2>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin}>Login</button>

        <p>
          No account?{" "}
          <button onClick={switchSignup}>
            Signup
          </button>
        </p>
      </div>
    </div>
  );
}