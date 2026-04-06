// components/Sidebar.jsx
import { useState } from 'react'
import './Sidebar.css'

export default function Sidebar({ sessions, currentSessionId, onNew, onSwitch, onDelete }) {
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
              onDelete={onDelete}
            />
          ))}
        </ul>
      </div>
    </aside>
  )
}

function SessionItem({ session, isActive, onSwitch, onDelete }) {
  const [hovered, setHovered] = useState(false)

  const handleDelete = (e) => {
    e.stopPropagation()
    if (confirm(`Delete "${session.title}" and its context file?`)) {
      onDelete(session.id)
    }
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
