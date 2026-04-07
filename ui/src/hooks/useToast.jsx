// hooks/useToast.js
// Context-based toast system — use useToast() anywhere in the app

import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

let _idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /**
   * Add a toast.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration  ms before auto-dismiss (0 = never)
   */
  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_idCounter
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  // Convenience shorthands
  toast.success = (msg, dur)  => toast(msg, 'success', dur)
  toast.error   = (msg, dur)  => toast(msg, 'error',   dur ?? 6000)
  toast.warning = (msg, dur)  => toast(msg, 'warning', dur)
  toast.info    = (msg, dur)  => toast(msg, 'info',    dur)

  return (
    <ToastContext.Provider value={{ toast, dismiss, toasts }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
