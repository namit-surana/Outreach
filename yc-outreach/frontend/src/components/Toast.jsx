import { useToast } from './ToastContext'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

export default function Toast() {
  const { toasts } = useToast()
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className="fade-in flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 shadow-lg text-sm">
          {t.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
