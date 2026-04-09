import './ModelSelector.css'

const MODE_ORDER = ['chat', 'code']

export default function ModelSelector({ currentMode, onChange, disabled, modes }) {
  return (
    <div className="model-selector">
      {MODE_ORDER.map((modeId) => (
        <button
          key={modeId}
          className={`mode-btn mode-btn--${modeId} ${currentMode === modeId ? 'active' : ''}`}
          onClick={() => !disabled && onChange(modeId)}
          disabled={disabled}
          aria-pressed={currentMode === modeId}
          title={modes?.[modeId] ? `${modes[modeId].id} • agentic • web access` : modeId}
        >
          {modeId === 'chat' ? '🧠 Chat' : '💻 Code'}
        </button>
      ))}
    </div>
  )
}
