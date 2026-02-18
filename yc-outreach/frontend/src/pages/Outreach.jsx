import { useState, useEffect } from 'react'
import { api } from '../api'
import CompanyDetail from '../components/CompanyDetail'
import { Loader2, Search } from 'lucide-react'

const COLUMNS = ['new', 'drafted', 'sent', 'replied', 'interview']
const COL_COLORS = {
  new: 'border-t-zinc-500',
  drafted: 'border-t-amber-500',
  sent: 'border-t-blue-500',
  replied: 'border-t-emerald-500',
  interview: 'border-t-purple-500',
}

export default function Outreach() {
  const [allOutreach, setAllOutreach] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [search, setSearch] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      // Get all outreach by fetching companies with each status
      const results = []
      for (const status of COLUMNS) {
        const data = await api.getCompanies({ status, per_page: 100 })
        for (const c of data.companies) {
          results.push({
            ...c,
            outreach_status: c.outreach_status || status,
          })
        }
      }
      // Dedupe by company id, keeping the entry with latest outreach
      const seen = new Map()
      for (const r of results) {
        if (!seen.has(r.id)) seen.set(r.id, r)
      }
      setAllOutreach(Array.from(seen.values()))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = search
    ? allOutreach.filter(o => o.name?.toLowerCase().includes(search.toLowerCase()))
    : allOutreach

  const byStatus = {}
  COLUMNS.forEach(s => { byStatus[s] = [] })
  filtered.forEach(o => {
    const s = o.outreach_status || 'new'
    if (byStatus[s]) byStatus[s].push(o)
  })

  const changeStatus = async (company, newStatus) => {
    try {
      // Get company details to find outreach id
      const detail = await api.getCompany(company.id)
      if (detail.outreach?.length) {
        await api.updateOutreach(detail.outreach[0].id, { status: newStatus })
      }
      fetchAll()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Outreach Pipeline</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input className="input pl-9 w-64" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {allOutreach.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20">
          <p className="text-lg mb-2">No outreach yet</p>
          <p className="text-sm">Go to Companies and start reaching out!</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4 min-h-[60vh]">
          {COLUMNS.map(col => (
            <div key={col} className={`bg-zinc-900/50 rounded-lg border border-zinc-800 border-t-2 ${COL_COLORS[col]}`}>
              <div className="p-3 border-b border-zinc-800">
                <h3 className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">{col}</h3>
                <span className="text-[10px] text-zinc-600">{byStatus[col].length} companies</span>
              </div>
              <div className="p-2 space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                {byStatus[col].map(o => (
                  <KanbanCard key={o.id} company={o} currentStatus={col} onStatusChange={changeStatus} onClick={() => setSelectedCompanyId(o.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCompanyId && (
        <CompanyDetail companyId={selectedCompanyId} onClose={() => setSelectedCompanyId(null)} onOutreachChange={fetchAll} />
      )}
    </div>
  )
}

function KanbanCard({ company, currentStatus, onStatusChange, onClick }) {
  // Add a method to get contact count for the company
  const contactCount = company.contact_count || 0;
  
  return (
    <div className="bg-zinc-800 rounded-lg p-3 cursor-pointer hover:bg-zinc-750 hover:border-zinc-600 border border-zinc-700/50 transition-all" onClick={onClick}>
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-xs font-semibold truncate flex-1">{company.name}</h4>
        <span className="badge bg-blue-500/20 text-blue-400 text-[10px] ml-1 shrink-0">{company.batch}</span>
      </div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] text-zinc-500 line-clamp-1 flex-1">{company.one_liner}</p>
        {contactCount > 0 && (
          <span className="text-[10px] bg-indigo-500/20 text-indigo-400 rounded-full px-1.5 py-0.5 flex items-center gap-1 ml-1 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            {contactCount}
          </span>
        )}
      </div>
      <select
        value={currentStatus}
        onChange={e => { e.stopPropagation(); onStatusChange(company, e.target.value) }}
        onClick={e => e.stopPropagation()}
        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none"
      >
        {COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}
