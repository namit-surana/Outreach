import { useState, useEffect } from 'react'
import { api } from '../api'
import { Building2, Bot, Send, MessageSquare, TrendingUp, Clock, User } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-zinc-400">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
  if (!stats) return <div className="text-zinc-400 text-center mt-20">Failed to load stats</div>

  const contacted = stats.total_outreach || 0
  const replied = (stats.outreach_by_status?.replied || 0) + (stats.outreach_by_status?.interview || 0)
  const totalContacts = stats.total_contacts || 0

  return (
    <div className="max-w-6xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={Building2} label="Total Companies" value={stats.total_companies} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={Bot} label="AI/ML Companies" value={stats.ai_companies} color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={Send} label="Contacted" value={contacted} color="bg-amber-500/10 text-amber-400" />
        <StatCard icon={MessageSquare} label="Replies" value={replied} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={TrendingUp} label="Response Rate" value={`${stats.response_rate}%`} color="bg-rose-500/10 text-rose-400" />
        <StatCard icon={User} label="Total Contacts" value={totalContacts} color="bg-indigo-500/10 text-indigo-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Batch breakdown */}
        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Companies by Batch</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_batch || {}).sort().reverse().map(([batch, count]) => (
              <div key={batch} className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-400 w-10">{batch}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(count / stats.total_companies) * 100}%` }} />
                </div>
                <span className="text-xs text-zinc-500 w-10 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Outreach breakdown */}
        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Outreach Pipeline</h2>
          {stats.total_outreach === 0 ? (
            <p className="text-zinc-500 text-sm">No outreach yet. Start by browsing companies!</p>
          ) : (
            <div className="space-y-3">
              {['new', 'drafted', 'sent', 'replied', 'interview'].map(s => {
                const count = stats.outreach_by_status?.[s] || 0
                const colors = { new: 'bg-zinc-500', drafted: 'bg-amber-500', sent: 'bg-blue-500', replied: 'bg-emerald-500', interview: 'bg-purple-500' }
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-zinc-400 w-16 capitalize">{s}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2">
                      <div className={`${colors[s]} h-2 rounded-full`} style={{ width: `${stats.total_outreach ? (count / stats.total_outreach) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        {/* Contact sources breakdown */}
        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Contact Sources</h2>
          {stats.total_contacts === 0 ? (
            <p className="text-zinc-500 text-sm">No contacts yet. Run the Recon agent to discover contacts!</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.contacts_by_source || {}).map(([source, count]) => {
                const colors = { 
                  github: 'bg-gray-600', 
                  yc_profile: 'bg-orange-500', 
                  linkedin_search: 'bg-blue-600', 
                  email_pattern: 'bg-green-500',
                  recon_agent: 'bg-purple-500'
                }
                const displaySource = source.replace('_', ' ');
                return (
                  <div key={source} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-zinc-400 w-28 capitalize">{displaySource}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2">
                      <div className={`${colors[source] || 'bg-zinc-500'} h-2 rounded-full`} style={{ width: `${stats.total_contacts ? (count / stats.total_contacts) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Matches */}
      {stats.top_matches?.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">🎯 Top Matches by Relevance</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {stats.top_matches.map(c => (
              <div key={c.id} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700/50">
                <div className="flex items-center gap-2 mb-1">
                  {c.logo_url && <img src={c.logo_url} alt="" className="w-5 h-5 rounded bg-zinc-700" />}
                  <span className="text-xs font-semibold truncate">{c.name}</span>
                </div>
                <span className={`badge text-[10px] ${c.relevance_score > 60 ? 'bg-emerald-500/20 text-emerald-400' : c.relevance_score > 30 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'}`}>
                  Score: {c.relevance_score}
                </span>
                <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1">{c.one_liner}</p>
              </div>
            ))}
          </div>
          {stats.last_agent_run && <p className="text-[10px] text-zinc-600 mt-2">Last agent run: {new Date(stats.last_agent_run).toLocaleString()}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Recent Activity
          </h2>
          {stats.recent_activity?.length ? (
            <div className="space-y-2">
              {stats.recent_activity.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div>
                    <span className="text-sm font-medium">{r.company_name}</span>
                    <span className="badge bg-zinc-800 text-zinc-400 ml-2">{r.company_batch}</span>
                  </div>
                  <span className={`badge ${statusColor(r.status)}`}>{r.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">No activity yet</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">⚡ Needs Follow-up</h2>
          {stats.needs_follow_up?.length ? (
            <div className="space-y-2">
              {stats.needs_follow_up.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-sm">{r.company_name}</span>
                  <span className="text-xs text-zinc-500">{r.sent_at?.split('T')[0]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">Nothing to follow up on</p>
          )}
        </div>
      </div>
    </div>
  )
}

function statusColor(s) {
  const m = { new: 'bg-zinc-700 text-zinc-300', drafted: 'bg-amber-500/20 text-amber-400', sent: 'bg-blue-500/20 text-blue-400', replied: 'bg-emerald-500/20 text-emerald-400', interview: 'bg-purple-500/20 text-purple-400' }
  return m[s] || m.new
}
