// services/ollama.js
// All streaming + model management calls to Ollama (direct, port 11434)

const OLLAMA = 'http://127.0.0.1:11434'

export async function checkOllamaStatus() {
  try {
    await fetch(`${OLLAMA}/api/tags`)
    return true
  } catch {
    return false
  }
}

export async function unloadModel(modelId) {
  try {
    await fetch(`${OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, keep_alive: 0 }),
    })
  } catch { /* ignore — model may not be loaded */ }
}

export async function preloadModel(modelId) {
  await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, keep_alive: '5m', options: { num_ctx: 2048 } }),
  })
}

/**
 * Stream a chat completion from Ollama.
 * Calls onChunk(parsedLine) for each streamed JSON line.
 * Returns the full response object when done.
 */
export async function streamChat({ model, messages, tools, options, onChunk }) {
  const body = { model, messages, stream: true, options }
  if (tools) body.tools = tools

  const response = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    let err
    try { err = JSON.parse(text).error } catch { err = text }
    throw new Error(err)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value, { stream: true }).split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        onChunk(parsed)
      } catch { /* incomplete chunk boundary */ }
    }
  }
}
