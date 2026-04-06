import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ModelSelector from './components/ModelSelector'
import ChatMessage from './components/ChatMessage'
import AgentStepsPanel from './components/AgentStepsPanel'
import MessageInput from './components/MessageInput'
import BhashiniModal from './components/BhashiniModal'
import { useSessionStore } from './hooks/useSessionStore'
import { runAgentLoop } from './hooks/useAgent'
import { contextApi } from './services/api'
import { checkOllamaStatus, unloadModel, preloadModel } from './services/ollama'
import './App.css'

const MODELS = {
  fast:  'gemma4:e2b',
  chat:  'qwen2.5:7b',
  code:  'qwen2.5-coder:7b',
  story: 'deepseek-r1:7b',
}

export default function App() {
  const {
    sessions, currentSession, currentSessionId,
    createSession, switchSession, deleteSession, updateSession,
  } = useSessionStore()

  const [currentMode, setCurrentMode] = useState('chat')
  const [isGenerating, setIsGenerating]   = useState(false)
  const [isSwapping, setIsSwapping]       = useState(false)
  const [status, setStatus]               = useState({ online: false, text: 'Checking Ollama...' })
  const [agentSteps, setAgentSteps]       = useState([])
  const [streamingText, setStreamingText] = useState('')
  const [bhashiniOpen, setBhashiniOpen]   = useState(false)

  const chatEndRef = useRef(null)

  // ── Ollama health check ──────────────────────────────────────────────────────
  useEffect(() => {
    checkOllamaStatus().then((ok) =>
      setStatus({ online: ok, text: ok ? 'Ollama Active' : 'Ollama Offline' })
    )
  }, [])

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages, streamingText, agentSteps])

  // ── Model swap ───────────────────────────────────────────────────────────────
  const handleModeChange = useCallback(async (mode) => {
    if (mode === currentMode || isSwapping || isGenerating) return
    setIsSwapping(true)
    setStatus({ online: true, text: 'Unloading models...' })

    const unused = Object.entries(MODELS).filter(([k]) => k !== mode).map(([, v]) => v)
    for (const m of unused) await unloadModel(m)

    setStatus({ online: true, text: `Booting ${MODELS[mode]}...` })
    try {
      await preloadModel(MODELS[mode])
      setCurrentMode(mode)
      setStatus({ online: true, text: `${mode.toUpperCase()} Ready` })
    } catch {
      setStatus({ online: false, text: 'Boot failed' })
    }
    setIsSwapping(false)
  }, [currentMode, isSwapping, isGenerating])

  // ── Delete session + context file ────────────────────────────────────────────
  const handleDeleteSession = useCallback((id) => {
    contextApi.delete(id).catch(() => {})
    deleteSession(id)
  }, [deleteSession])

  // ── Attach context ────────────────────────────────────────────────────────────
  const handleAttachContext = useCallback(async () => {
    let existing = '{}'
    try {
      const resp = await contextApi.get(currentSessionId)
      if (resp.ok) existing = await resp.text()
    } catch {}
    const input = prompt('Paste custom rules, background, or JSON knowledge:\nThe agent will read this automatically.', existing)
    if (input !== null) {
      await contextApi.save(currentSessionId, input)
      alert(`Context saved to backend/data/contexts/${currentSessionId}.json`)
    }
  }, [currentSessionId])

  // ── Send message → agent loop ─────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    if (isGenerating || isSwapping) return

    let session = currentSession
    // Auto-title on first message
    if (session.messages.length === 1 && session.messages[0].role === 'system') {
      const title = text.trim().split(/\s+/).slice(0, 4).join(' ') + (text.split(/\s+/).length > 4 ? '…' : '')
      updateSession(currentSessionId, (s) => ({ ...s, title }))
    }

    // Push user message
    const messagesWithUser = [...session.messages, { role: 'user', content: text }]
    updateSession(currentSessionId, (s) => ({ ...s, messages: messagesWithUser }))

    setIsGenerating(true)
    setAgentSteps([])
    setStreamingText('')

    await runAgentLoop({
      mode: currentMode,
      messages: messagesWithUser,
      sessionId: currentSessionId,
      onToken: (full) => setStreamingText(full),
      onStep: (step) => setAgentSteps((prev) => [...prev, step]),
      onDone: (_, finalMessages) => {
        updateSession(currentSessionId, (s) => ({
          ...s,
          messages: finalMessages,
          updatedAt: Date.now(),
        }))
        setStreamingText('')
      },
      onError: (msg) => {
        updateSession(currentSessionId, (s) => ({
          ...s,
          messages: [...messagesWithUser, { role: 'assistant', content: `**Error:** ${msg}` }],
        }))
        setStreamingText('')
        setStatus({ online: false, text: msg })
      },
    })

    setIsGenerating(false)
    setAgentSteps([])
  }, [currentSession, currentSessionId, currentMode, isGenerating, isSwapping, updateSession])

  // ── Render messages ───────────────────────────────────────────────────────────
  const visibleMessages = (currentSession?.messages || []).filter(
    (m) => m.role !== 'system' && m.role !== 'tool'
  )

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNew={createSession}
        onSwitch={switchSession}
        onDelete={handleDeleteSession}
      />

      <div className="app-main">
        {/* Header */}
        <header className="app-header">
          <div className="app-logo">
            <span className="logo-icon">✧</span>
            <h1>Gemma Chat</h1>
          </div>

          <ModelSelector
            currentMode={currentMode}
            onChange={handleModeChange}
            disabled={isGenerating || isSwapping}
          />

          <div className="header-actions">
            <button className="header-btn" onClick={() => setBhashiniOpen(true)}>
              ⚙️ Bhashini
            </button>
            <button className="header-btn" onClick={handleAttachContext}>
              📄 Context
            </button>
            <div className="status-pill">
              <span className="status-dot" style={{ background: status.online ? '#10b981' : '#ef4444', boxShadow: `0 0 7px ${status.online ? '#10b981' : '#ef4444'}` }} />
              <span className="status-text">{status.text}</span>
            </div>
          </div>
        </header>

        {/* Chat area */}
        <main className="chat-area">
          <div className="chat-history">
            {visibleMessages.length === 0 && (
              <div className="welcome-msg">Hello! How can I help you today?</div>
            )}
            {visibleMessages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}

            {/* Live agent steps */}
            {isGenerating && agentSteps.length > 0 && (
              <AgentStepsPanel steps={agentSteps} />
            )}

            {/* Live streaming token output */}
            {isGenerating && streamingText && (
              <ChatMessage role="assistant" content={streamingText} />
            )}

            {/* Thinking spinner when no tokens yet */}
            {isGenerating && !streamingText && agentSteps.length === 0 && (
              <div className="thinking-spinner">
                <div className="spinner" />
                <span>Thinking…</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </main>

        {/* Footer input */}
        <footer className="app-footer">
          <MessageInput onSend={handleSend} disabled={isGenerating || isSwapping} />
          <p className="disclaimer">Responses are generated locally. Your data never leaves your machine.</p>
        </footer>
      </div>

      <BhashiniModal isOpen={bhashiniOpen} onClose={() => setBhashiniOpen(false)} />
    </div>
  )
}
