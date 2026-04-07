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

/**
 * Per-chat message history stored as backend/data/chats/<id>.json
 * Payload shape: { id, title, updatedAt, messages: [...] }
 */
export const chatsApi = {
  /** Load a full session (messages + metadata) from the backend file. */
  get: (sessionId) =>
    fetch(`${BASE}/api/chats/${sessionId}`).then((r) => {
      if (!r.ok) return null
      return r.json()
    }),

  /** Persist the entire session object to backend/data/chats/<id>.json */
  save: (session) =>
    fetch(`${BASE}/api/chats/${session.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    }),

  /** Delete the chat file (backend also removes the context file). */
  delete: (sessionId) =>
    fetch(`${BASE}/api/chats/${sessionId}`, { method: 'DELETE' }),
}
