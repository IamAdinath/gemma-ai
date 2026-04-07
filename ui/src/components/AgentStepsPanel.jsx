import './AgentStepsPanel.css'

export default function AgentStepsPanel({ steps }) {
  if (!steps || steps.length === 0) return null
  return (
    <div className="message message--assistant">
      <div className="agent-panel">
        {steps.map((step, i) => (
          <div className="agent-step" key={i}>
            <span className="agent-step-icon">{step.icon}</span>
            <span className="agent-step-label">{step.label}</span>
            {step.detail && (
              <span className="agent-step-detail">{step.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
