// components/ToastContainer.jsx
import { useToast } from '../hooks/useToast'
import './ToastContainer.css'

const ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`} role="alert">
          <span className="toast-icon">{ICONS[t.type]}</span>
          <span className="toast-message">{t.message}</span>
          <button
            className="toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
