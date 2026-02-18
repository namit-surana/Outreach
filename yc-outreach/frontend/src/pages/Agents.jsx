import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { useToast } from '../components/ToastContext'
import { Search, Loader2, Play, ArrowRight, Clock, Bot } from 'lucide-react'

const AGENTS = [
  { key: 'scout', icon: '🔍', label: 'Scout', color: 'blue', desc: 'Scrape & score companies' },
  { key: 'recon', icon: '🕵️', label: 'Recon', color: 'purple', desc: 'Find contacts & emails' },
  { key: 'writer', icon: '✍️', label: 'Writer', color: 'emerald', desc: 'Draft outreach emails' },
  { key: 'tracker', icon: '📊', label: 'Tracker', color: 'amber', desc: 'Track follow-ups' },
]

const BORDER_COLORS = {
  blue: 'border-t-blue-500',
  purple: 'border-t-purple-500',
  emerald: 'border-t-emerald-500',
  amber: 'border-t-amber-500',
}

const BG_COLORS = {
  blue: 'bg-blue-500/10 text-blue-400',
  purple: 'bg-purple-500/10 text-purple-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-400',
}

const DOT_COLORS = {
  scout: 'bg-blue-500',
  recon: 'bg-purple-500',
  writer: 'bg-emerald-500',
  tracker: 'bg-amber-500',
  orchestrator: 'bg-zinc-500',
}

export default function Agents() {
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [logFilter, setLogFilter] = useState(null)
  const [running, setRunning] = useState(null) // agent key or 'all'
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()
  const logEndRef = useRef(null)

  const fetchData = async () => {
    try {
      const [s, l] = await Promise.all([
        api.getAgentStatus(),
        api.getAgentLogs({ limit: 100, agent_name: logFilter || undefined }),
      ])
      setStatus(s)
      setLogs(l.logs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [logFilter])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const runAgent = async (key) => {
    setRunning(key)
    try {
      if (key === 'all') {
        await api.runAllAgents()
        addToast('Pipeline complete')
      } else {
        await api.runAgent(key)
        addToast(`${key} agent complete`)
      }
      await fetchData()
    } catch (e) {
      addToast(`Agent error: ${e.message}`, 'error')
    } finally {
      setRunning(null)
    }
  }

  const getMetric = (key) => {
    if (!status) return '—'
    switch (key) {
      case 'scout': return `${status.companies_scored || 0} scored`
      case 'recon': return `${status.companies_enriched || 0} enriched / ${status.recon_contacts || 0} contacts`
      case 'writer': return 'Coming soon'
      case 'tracker': return `${status.needs_followup || 0} follow-ups`
      default: return '—'
    }
  }

  const getLastRun = (key) => {
    if (!status?.agents?.[key]?.last_run) return 'Never'
    const d = new Date(status.agents[key].last_run)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-6xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="w-6 h-6" /> Agent Pipeline</h1>
        <button
          onClick={() => runAgent('all')}
          disabled={running !== null}
          className="btn-primary flex items-center gap-2"
        >
          {running === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run All Agents
        </button>
      </div>

      {/* Pipeline Visualization */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {AGENTS.map((agent, i) => (
            <div key={agent.key} className="flex items-center gap-3 shrink-0">
              <div className={`relative w-48 bg-zinc-800 rounded-lg border border-zinc-700 border-t-2 ${BORDER_COLORS[agent.color]} p-4 transition-all ${
                running === agent.key || running === 'all' ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-blue-500/50' : ''
              }`}>
                {(running === agent.key || running === 'all') && (
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{agent.icon}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${BG_COLORS[agent.color]}`}>{agent.label}</span>
                </div>
                <p className="text-lg font-bold mb-0.5">{getMetric(agent.key)}</p>
                <p className="text-[10px] text-zinc-500 mb-3">{agent.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1"><Clock className="w-3 h-3" />{getLastRun(agent.key)}</span>
                  <button
                    onClick={() => runAgent(agent.key)}
                    disabled={running !== null}
                    className="text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded transition-colors disabled:opacity-40"
                  >
                    {running === agent.key ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Run'}
                  </button>
                </div>
              </div>
              {i < AGENTS.length - 1 && <ArrowRight className="w-5 h-5 text-zinc-600 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Agent Activity Log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-300">Agent Activity Log</h2>
          <div className="flex gap-1">
            {[null, 'scout', 'recon', 'writer', 'tracker'].map(f => (
              <button
                key={f || 'all'}
                onClick={() => setLogFilter(f)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  logFilter === f ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {logs.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-8">No agent activity yet. Run an agent to see logs here.</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-zinc-800/50 text-xs">
                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${DOT_COLORS[log.agent_name] || 'bg-zinc-500'}`} />
                <span className="text-zinc-600 shrink-0 w-14">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-zinc-500 shrink-0 w-16 font-medium">{log.agent_name}</span>
                <span className={`flex-1 ${log.status === 'error' ? 'text-red-400' : log.status === 'success' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {log.details}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  )
}
