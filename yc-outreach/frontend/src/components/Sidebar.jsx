import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, Mail, Settings, Rocket, Bot, Power, Users } from 'lucide-react'
import { useState } from 'react'

const API = 'http://localhost:8000'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/companies', icon: Building2, label: 'Companies' },
  { to: '/outreach', icon: Mail, label: 'Outreach' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const [shutting, setShutting] = useState(false)

  const handleShutdown = async () => {
    if (!confirm('Shut down YC Outreach? This will stop both frontend and backend.')) return
    setShutting(true)
    try {
      await fetch(`${API}/api/shutdown`, { method: 'POST' })
    } catch (e) {
      // expected — server dies before responding
    }
    // close the browser tab after a brief delay
    setTimeout(() => window.close(), 1000)
  }

  return (
    <aside className="w-60 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      <div className="p-5 flex items-center gap-2">
        <Rocket className="w-5 h-5 text-blue-500" />
        <span className="text-lg font-bold">YC Outreach</span>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-blue-400 border-l-2 border-blue-500'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-3">
        <button
          onClick={handleShutdown}
          disabled={shutting}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-50"
        >
          <Power className="w-4 h-4" />
          {shutting ? 'Shutting down...' : 'Shut Down'}
        </button>
      </div>
      <div className="p-4 pt-0 text-xs text-zinc-600">Built for Namit 🚀</div>
    </aside>
  )
}
