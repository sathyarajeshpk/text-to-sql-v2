const API = import.meta.env.VITE_API_URL;

fetch(`${API}/login`)

export async function signup(data) {
  const res = await fetch(`${API}/api/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function login(data) {
  const res = await fetch(`${API}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return res.json();
}