import { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import './Sidebar.css'

export default function Sidebar({ sessions, currentSessionId, onNew, onSwitch, onDelete }) {
  const [sessionToDelete, setSessionToDelete] = useState(null)

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNew}>
          <span className="new-chat-icon">+</span>
          New Chat
        </button>
      </div>

      <div className="chat-list-container">
        <p className="list-heading">Recent</p>
        <ul className="chat-list">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              onSwitch={onSwitch}
              onDeleteRequest={() => setSessionToDelete(session)}
            />
          ))}
        </ul>
      </div>

      <ConfirmModal
        isOpen={!!sessionToDelete}
        title="Delete Chat"
        message={`Are you sure you want to delete "${sessionToDelete?.title}"? This cannot be undone.`}
        confirmText="Delete"
        destructive={true}
        onConfirm={() => {
          if (sessionToDelete) onDelete(sessionToDelete.id)
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </aside>
  )
}

function SessionItem({ session, isActive, onSwitch, onDeleteRequest }) {
  const [hovered, setHovered] = useState(false)

  const handleDelete = (e) => {
    e.stopPropagation()
    onDeleteRequest()
  }

  return (
    <li
      className={`chat-item ${isActive ? 'active' : ''}`}
      onClick={() => onSwitch(session.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="chat-item-title">{session.title}</span>
      {hovered && (
        <button className="delete-chat-btn" onClick={handleDelete} title="Delete chat">
          ✖
        </button>
      )}
    </li>
  )
}
