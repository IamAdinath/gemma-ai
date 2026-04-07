
import { useState, useEffect, useCallback } from 'react'
import { chatsApi } from '../services/api'

const INDEX_KEY = 'gemma_sessions_index'

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

function loadIndex() {
  try {
    const raw = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((s) => s && s.id) : []
  } catch {
    return []
  }
}

function saveIndex(index) {
  localStorage.setItem(
    INDEX_KEY,
    JSON.stringify(index.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })))
  )
}

export function useSessionStore() {
  const [index, setIndex] = useState(() => loadIndex())          // lightweight list
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [currentSession, setCurrentSession] = useState(null)     // full session w/ messages
  const [loadingSession, setLoadingSession] = useState(false)

  useEffect(() => {
    if (index.length === 0) {
      const fresh = makeNewSession()
      chatsApi.save(fresh)          // persist to backend
      const newIndex = [{ id: fresh.id, title: fresh.title, updatedAt: fresh.updatedAt }]
      setIndex(newIndex)
      saveIndex(newIndex)
      setCurrentSessionId(fresh.id)
      setCurrentSession(fresh)
    } else {
      setCurrentSessionId(index[0].id)
    }
  }, []) // run once on mount

  useEffect(() => {
    if (!currentSessionId) return
    setLoadingSession(true)
    chatsApi.get(currentSessionId)
      .then((data) => {
        if (data) {
          setCurrentSession(data)
        } else {
          // Backend file missing — recreate it from index metadata
          const meta = index.find((s) => s.id === currentSessionId)
          const recovered = {
            id: currentSessionId,
            title: meta?.title ?? 'New Chat',
            updatedAt: Date.now(),
            messages: [makeSystemPrompt()],
          }
          chatsApi.save(recovered)
          setCurrentSession(recovered)
        }
        setLoadingSession(false)
      })
      .catch(() => {
        // Backend unreachable — show a blank session, don't crash
        setCurrentSession({
          id: currentSessionId,
          title: 'New Chat',
          updatedAt: Date.now(),
          messages: [makeSystemPrompt()],
        })
        setLoadingSession(false)
      })
  }, [currentSessionId])

  const createSession = useCallback(() => {
    const fresh = makeNewSession()
    chatsApi.save(fresh)
    setIndex((prev) => {
      const next = [{ id: fresh.id, title: fresh.title, updatedAt: fresh.updatedAt }, ...prev]
      saveIndex(next)
      return next
    })
    setCurrentSessionId(fresh.id)
    setCurrentSession(fresh)
    return fresh
  }, [])

  const switchSession = useCallback((id) => {
    if (id === currentSessionId) return
    setCurrentSessionId(id)
    setCurrentSession(null) // will be loaded by useEffect above
  }, [currentSessionId])

  const deleteSession = useCallback((id) => {
    chatsApi.delete(id)
    setIndex((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (next.length === 0) {
        // Create a replacement session
        const fresh = makeNewSession()
        chatsApi.save(fresh)
        const newIndex = [{ id: fresh.id, title: fresh.title, updatedAt: fresh.updatedAt }]
        saveIndex(newIndex)
        setCurrentSessionId(fresh.id)
        setCurrentSession(fresh)
        return newIndex
      }
      saveIndex(next)
      if (id === currentSessionId) {
        setCurrentSessionId(next[0].id)
        setCurrentSession(null)
      }
      return next
    })
  }, [currentSessionId])
  const updateSession = useCallback((updatedSession) => {
    chatsApi.save(updatedSession)   // write full session to backend
    setCurrentSession(updatedSession)
    setIndex((prev) => {
      const updated = prev.map((s) =>
        s.id === updatedSession.id
          ? { id: s.id, title: updatedSession.title, updatedAt: updatedSession.updatedAt }
          : s
      )
      // Bubble to top
      const target = updated.find((s) => s.id === updatedSession.id)
      const rest   = updated.filter((s) => s.id !== updatedSession.id)
      const next   = target ? [target, ...rest] : updated
      saveIndex(next)
      return next
    })
  }, [])

  return {
    sessions: index,              // lightweight index for sidebar
    currentSession,               // full session with messages (null while loading)
    currentSessionId,
    loadingSession,
    createSession,
    switchSession,
    deleteSession,
    updateSession,
  }
}
