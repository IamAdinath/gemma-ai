// hooks/useSessionStore.js
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'gemma_sessions'

function makeSystemPrompt() {
  return {
    role: 'system',
    content:
      'You are a highly capable local AI assistant inspired by Google Gemini. Be helpful, precise, and intelligent.',
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 5)
}

function makeNewSession() {
  return {
    id: generateId(),
    title: 'New Chat',
    updatedAt: Date.now(),
    messages: [makeSystemPrompt()],
  }
}

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    // Sanitise: filter out any null/malformed entries that could cause .id errors
    const valid = Array.isArray(parsed) ? parsed.filter((s) => s && s.id) : []
    return valid
  } catch {
    return []
  }
}

function save(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export function useSessionStore() {
  // ── Derive initial state once from the same seed ─────────────────────────────
  const [sessions, setSessions] = useState(() => {
    const stored = load()
    if (stored.length > 0) return stored
    const fresh = makeNewSession()
    save([fresh])
    return [fresh]
  })

  // Always seed currentSessionId from the *same* sessions array above
  const [currentSessionId, setCurrentSessionId] = useState(
    () => sessions[0]?.id ?? null
  )

  // ── Actions ───────────────────────────────────────────────────────────────────
  const createSession = useCallback(() => {
    const fresh = makeNewSession()
    setSessions((prev) => {
      const next = [fresh, ...prev]
      save(next)
      return next
    })
    setCurrentSessionId(fresh.id)
    return fresh
  }, [])

  const switchSession = useCallback((id) => {
    setCurrentSessionId(id)
  }, [])

  const deleteSession = useCallback((id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (next.length === 0) {
        const fresh = makeNewSession()
        save([fresh])
        setCurrentSessionId(fresh.id)
        return [fresh]
      }
      save(next)
      setCurrentSessionId((cur) => (cur === id ? next[0].id : cur))
      return next
    })
  }, [])

  const updateSession = useCallback((id, updater) => {
    setSessions((prev) => {
      const updated   = prev.map((s) => (s.id === id ? updater(s) : s))
      const target    = updated.find((s) => s.id === id)
      const rest      = updated.filter((s) => s.id !== id)
      const reordered = target ? [target, ...rest] : updated
      save(reordered)
      return reordered
    })
  }, [])

  // ── Derived state ─────────────────────────────────────────────────────────────
  const currentSession =
    sessions.find((s) => s.id === currentSessionId) ?? sessions[0] ?? null

  return {
    sessions,
    currentSession,
    currentSessionId: currentSession?.id ?? null,
    createSession,
    switchSession,
    deleteSession,
    updateSession,
  }
}
