// components/BhashiniModal.jsx
import { useState, useEffect } from 'react'
import { useToast } from '../hooks/useToast'
import './BhashiniModal.css'

const LANGUAGES = [
  { code: 'mr', label: 'Marathi' },
  { code: 'hi', label: 'Hindi'   },
  { code: 'ta', label: 'Tamil'   },
  { code: 'te', label: 'Telugu'  },
]

export default function BhashiniModal({ isOpen, onClose }) {
  const [apiKey, setApiKey]   = useState('')
  const [lang, setLang]       = useState('mr')
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      const conf = JSON.parse(localStorage.getItem('bhashini_config') || '{}')
      setApiKey(conf.key || '')
      setLang(conf.lang || 'mr')
    }
  }, [isOpen])

  const save = () => {
    if (!apiKey.trim()) {
      toast.warning('Please enter an API key before saving.')
      return
    }
    localStorage.setItem('bhashini_config', JSON.stringify({ key: apiKey.trim(), lang }))
    toast.success('Bhashini config saved!')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">⚙️ Bhashini API</h2>
        <p className="modal-subtitle">
          Get a free key at{' '}
          <a href="https://bhashini.gov.in" target="_blank" rel="noreferrer">bhashini.gov.in</a>
        </p>

        <label className="modal-label">API Key / Auth Token</label>
        <input
          type="password"
          className="modal-input"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste your key here"
        />

        <label className="modal-label">Target Language</label>
        <select className="modal-input" value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="modal-btn modal-btn--save" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
