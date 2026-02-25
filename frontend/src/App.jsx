import { useState, useEffect } from "react";
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";

export default function App() {
  const [token, setToken] = useState(null);
  const [mode, setMode] = useState("login");

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) setToken(t);
  }, []);

  const handleLogin = () => {
    const t = localStorage.getItem("token");
    setToken(t);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  if (!token) {
    if (mode === "login")
      return (
        <Login
          onLogin={handleLogin}
          switchSignup={() => setMode("signup")}
        />
      );

    return (
      <Signup
        switchLogin={() => setMode("login")}
      />
    );
  }

  return <Dashboard onLogout={handleLogout} />;
}