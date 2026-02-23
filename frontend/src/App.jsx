import { useState } from "react";
import Login from "./Login";
import Signup from "./Signup";

function Dashboard() {
  return <h2>Welcome to Dashboard 🚀</h2>;
}

export default function App() {
  const [page, setPage] = useState("login");
  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  if (loggedIn) return <Dashboard />;

  return (
    <div>
      {page === "login" ? (
        <>
          <Login onLogin={() => setLoggedIn(true)} />
          <p>
            No account?{" "}
            <button onClick={() => setPage("signup")}>
              Signup
            </button>
          </p>
        </>
      ) : (
        <>
          <Signup onSignup={() => setLoggedIn(true)} />
          <p>
            Have account?{" "}
            <button onClick={() => setPage("login")}>
              Login
            </button>
          </p>
        </>
      )}
    </div>
  );
}