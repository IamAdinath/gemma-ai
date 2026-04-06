// components/ModelSelector.jsx
import './ModelSelector.css'

const MODES = [
  { id: 'fast',  label: '⚡ Fast'  },
  { id: 'chat',  label: '🧠 Chat'  },
  { id: 'code',  label: '💻 Code'  },
  { id: 'story', label: '✍️ Story' },
]

export default function ModelSelector({ currentMode, onChange, disabled }) {
  return (
    <div className="model-selector">
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`mode-btn mode-btn--${m.id} ${currentMode === m.id ? 'active' : ''}`}
          onClick={() => !disabled && onChange(m.id)}
          disabled={disabled}
          aria-pressed={currentMode === m.id}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
