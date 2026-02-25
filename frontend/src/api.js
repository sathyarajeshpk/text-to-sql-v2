const API = import.meta.env.VITE_API_URL;

// ---------- AUTH ----------

export async function signup(data) {
  const res = await fetch(`${API}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function login(data) {
  const res = await fetch(`${API}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ---------- DATABASE ----------

export async function connectDatabase(payload) {
  const res = await fetch(`${API}/api/connect/database`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---------- CSV ----------

export async function uploadCSV(files) {
  const form = new FormData();
  for (let f of files) form.append("files", f);

  const res = await fetch(`${API}/api/upload/csv-multi`, {
    method: "POST",
    body: form,
  });

  return res.json();
}

// ---------- QUERY ----------

export async function runQuery(payload) {
  const res = await fetch(`${API}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.json();
}