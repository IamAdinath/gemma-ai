// components/MessageInput.jsx
import { useRef, useEffect } from 'react'
import './MessageInput.css'

export default function MessageInput({ onSend, disabled }) {
  const ref = useRef(null)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const submit = () => {
    const text = ref.current?.value.trim()
    if (!text || disabled) return
    onSend(text)
    ref.current.value = ''
    ref.current.style.height = 'auto'
  }

  const autoResize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  useEffect(() => {
    if (!disabled) ref.current?.focus()
  }, [disabled])

  return (
    <div className="input-form">
      <textarea
        ref={ref}
        className="message-textarea"
        placeholder="Message Gemma..."
        rows={1}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onInput={autoResize}
      />
      <button
        className="send-button"
        onClick={submit}
        disabled={disabled}
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
