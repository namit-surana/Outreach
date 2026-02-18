import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Outreach from './pages/Outreach'
import Contacts from './pages/Contacts'
import Agents from './pages/Agents'
import Toast from './components/Toast'
import { ToastProvider } from './components/ToastContext'

export default function App() {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/outreach" element={<Outreach />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/settings" element={<div className="text-zinc-400 text-center mt-20">Settings coming soon...</div>} />
          </Routes>
        </main>
        <Toast />
      </div>
    </ToastProvider>
  )
}
