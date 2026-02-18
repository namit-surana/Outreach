import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  return <Ctx.Provider value={{ toasts, addToast }}>{children}</Ctx.Provider>
}

export function useToast() {
  return useContext(Ctx)
}
