import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ModelSelector from './components/ModelSelector'
import ChatMessage from './components/ChatMessage'
import AgentStepsPanel from './components/AgentStepsPanel'
import MessageInput from './components/MessageInput'
import BhashiniModal from './components/BhashiniModal'
import ConfirmModal from './components/ConfirmModal'
import ToastContainer from './components/ToastContainer'
import { useSessionStore } from './hooks/useSessionStore'
import { runAgentLoop } from './hooks/useAgent'
import { useToast } from './hooks/useToast'
import { contextApi, chatsApi } from './services/api'
import { checkOllamaStatus, unloadModel, preloadModel } from './services/ollama'
import './App.css'

const MODELS = {
  chat:  'gemma4:e2b',
  code:  'qwen2.5-coder:7b',
  story: 'deepseek-r1:7b',
}

export default function App() {
  const {
    sessions, currentSession, currentSessionId, loadingSession,
    createSession, switchSession, deleteSession, updateSession,
  } = useSessionStore()

  const { toast } = useToast()

  const [currentMode, setCurrentMode] = useState('chat')
  const [isGenerating, setIsGenerating]   = useState(false)
  const [isSwapping, setIsSwapping]       = useState(false)
  const [status, setStatus]               = useState({ online: false, text: 'Checking Ollama...' })
  const [agentSteps, setAgentSteps]       = useState([])
  const [streamingText, setStreamingText] = useState('')
  const [bhashiniOpen, setBhashiniOpen]   = useState(false)
  const [turnOffConfirmOpen, setTurnOffConfirmOpen] = useState(false)

  const chatEndRef = useRef(null)

  useEffect(() => {
    checkOllamaStatus().then((ok) =>
      setStatus({ online: ok, text: ok ? 'Ollama Active' : 'Ollama Offline' })
    )
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages, streamingText, agentSteps])

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
      toast.success(`Switched to ${mode.toUpperCase()} mode`)
    } catch {
      setStatus({ online: false, text: 'Boot failed' })
      toast.error(`Failed to load model for ${mode} mode. Is Ollama running?`)
    }
    setIsSwapping(false)
  }, [currentMode, isSwapping, isGenerating])

  const handleDeleteSession = useCallback((id) => {
    chatsApi.delete(id).catch(() => {})
    deleteSession(id)
  }, [deleteSession])

  const handleSend = useCallback(async (text) => {
    if (isGenerating || isSwapping || !currentSession) return

    let session = { ...currentSession }

    // Auto-title on first message
    if (session.messages.length === 1 && session.messages[0].role === 'system') {
      session = {
        ...session,
        title: text.trim().split(/\s+/).slice(0, 4).join(' ') + (text.split(/\s+/).length > 4 ? '…' : ''),
      }
    }

    // Push user message
    const messagesWithUser = [...session.messages, { role: 'user', content: text }]
    const sessionWithUser = { ...session, messages: messagesWithUser, updatedAt: Date.now() }
    updateSession(sessionWithUser)

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
        updateSession({ ...sessionWithUser, messages: finalMessages, updatedAt: Date.now() })
        setStreamingText('')
      },
      onError: (msg) => {
        updateSession({
          ...sessionWithUser,
          messages: [...messagesWithUser, { role: 'assistant', content: `**Error:** ${msg}` }],
        })
        setStreamingText('')
        setStatus({ online: false, text: msg })
        toast.error(`Model error: ${msg}`)
      },
    })

    setIsGenerating(false)
    setAgentSteps([])
  }, [currentSession, currentSessionId, currentMode, isGenerating, isSwapping, updateSession])

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
            <button className="header-btn power-btn" onClick={() => setTurnOffConfirmOpen(true)} style={{ color: '#ef4444' }}>
              ⏻ Turn Off
            </button>
            <button className="header-btn" onClick={() => setBhashiniOpen(true)}>
              ⚙️ Bhashini
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
            {loadingSession ? (
              <div className="thinking-spinner" style={{ margin: '4rem auto' }}>
                <div className="spinner" />
                <span>Loading chat…</span>
              </div>
            ) : (
              <>
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
              </>
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
      
      <ConfirmModal
        isOpen={turnOffConfirmOpen}
        title="Turn Off Gemma AI"
        message="This will force-unload any active AI models to release RAM, stop all backend and frontend services, and close the application."
        confirmText="Turn Off"
        destructive={true}
        onConfirm={async () => {
          toast.info('Shutting down... you can safely close this window.')
          await fetch('/api/shutdown', { method: 'POST' }).catch(() => {})
          setTimeout(() => window.close(), 1000)
        }}
        onCancel={() => setTurnOffConfirmOpen(false)}
      />

      <ToastContainer />
    </div>
  )
}
