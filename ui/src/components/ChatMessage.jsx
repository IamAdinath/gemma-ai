// components/ChatMessage.jsx
import { useEffect, useRef } from 'react'
import { marked } from 'marked'
import './ChatMessage.css'

function renderContent(text) {
  let out = text
  out = out.replace(/<think>/g, '<details class="thinking-block" open><summary>💭 Thinking Process</summary>\n\n')
  out = out.replace(/<\/think>/g, '\n\n</details>\n\n')
  const opens = (out.match(/<details class="thinking-block" open>/g) || []).length
  const closes = (out.match(/<\/details>/g) || []).length
  if (opens > closes) out += '\n\n</details>'
  return marked.parse(out)
}

export default function ChatMessage({ role, content }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && role === 'assistant') {
      ref.current.innerHTML = renderContent(content)
    }
  }, [content, role])

  if (role === 'user') {
    return (
      <div className="message message--user">
        <div className="message-content message-content--user">{content}</div>
      </div>
    )
  }

  return (
    <div className="message message--assistant">
      <div className="message-content message-content--assistant" ref={ref} />
    </div>
  )
}
