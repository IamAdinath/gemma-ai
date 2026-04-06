// services/api.js
// All calls to the FastAPI backend (/api/*)

const BASE = ''  // Vite proxy handles /api → localhost:8000

export const contextApi = {
  get: (sessionId) => fetch(`${BASE}/api/context/${sessionId}`),
  save: (sessionId, body) => fetch(`${BASE}/api/context/${sessionId}`, { method: 'POST', body }),
  delete: (sessionId) => fetch(`${BASE}/api/context/${sessionId}`, { method: 'DELETE' }),
}

export const toolsApi = {
  runPython: (code) =>
    fetch(`${BASE}/api/tools/run_python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then((r) => r.json()),

  fetchUrl: (url) =>
    fetch(`${BASE}/api/tools/fetch_url?url=${encodeURIComponent(url)}`).then((r) => r.json()),
}
