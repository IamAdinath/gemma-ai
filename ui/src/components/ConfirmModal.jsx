import './ConfirmModal.css'

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', destructive = false }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-subtitle confirm-message">{message}</p>
        
        <div className="modal-actions confirm-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className={`modal-btn ${destructive ? 'modal-btn--destructive' : 'modal-btn--save'}`} 
            onClick={() => {
              onConfirm()
              onCancel()
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
