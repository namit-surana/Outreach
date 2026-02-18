import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import CompanyDetail from '../components/CompanyDetail'
import { Search, Loader2, Users, MapPin } from 'lucide-react'

const BATCHES = ['W25', 'S24', 'W24', 'S23', 'W23']

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBatches, setSelectedBatches] = useState([])
  const [aiOnly, setAiOnly] = useState(false)
  const [hiringOnly, setHiringOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [sortRelevance, setSortRelevance] = useState(false)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: 30 }
      if (search) params.search = search
      if (selectedBatches.length) params.batch = selectedBatches.join(',')
      if (hiringOnly) params.is_hiring = true
      if (aiOnly) params.industry = 'AI'
      if (sortRelevance) params.sort_by = 'relevance'
      const data = await api.getCompanies(params)
      setCompanies(data.companies)
      setTotal(data.total)
      setPages(data.pages)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, search, selectedBatches, aiOnly, hiringOnly, sortRelevance])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])
  useEffect(() => { setPage(1) }, [search, selectedBatches, aiOnly, hiringOnly, sortRelevance])

  const toggleBatch = (b) => setSelectedBatches(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])

  return (
    <div className="max-w-6xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Companies</h1>
        <span className="text-sm text-zinc-500">{total} companies</span>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              className="input w-full pl-9"
              placeholder="Search companies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {BATCHES.map(b => (
              <button
                key={b}
                onClick={() => toggleBatch(b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedBatches.includes(b) ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAiOnly(!aiOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${aiOnly ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            🤖 AI Only
          </button>
          <button
            onClick={() => setHiringOnly(!hiringOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hiringOnly ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            💼 Hiring
          </button>
          <button
            onClick={() => setSortRelevance(!sortRelevance)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortRelevance ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            ⭐ Sort by Relevance
          </button>
        </div>
      </div>

      {/* Company List */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : companies.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20">
          <p className="text-lg mb-2">No companies found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {companies.map(c => (
              <CompanyCard key={c.id} company={c} onClick={() => setSelectedId(c.id)} />
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs disabled:opacity-40">Prev</button>
              <span className="text-sm text-zinc-500">Page {page} of {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-secondary text-xs disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}

      {selectedId && (
        <CompanyDetail companyId={selectedId} onClose={() => setSelectedId(null)} onOutreachChange={fetchCompanies} />
      )}
    </div>
  )
}

function CompanyCard({ company, onClick }) {
  const industries = Array.isArray(company.industries) ? company.industries : []
  const locations = Array.isArray(company.locations) ? company.locations : []
  const statusDot = {
    new: 'bg-zinc-500', drafted: 'bg-amber-500', sent: 'bg-blue-500', replied: 'bg-emerald-500', interview: 'bg-purple-500'
  }

  return (
    <div onClick={onClick} className="card hover:border-zinc-600 cursor-pointer transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {company.logo_url && <img src={company.logo_url} alt="" className="w-8 h-8 rounded bg-zinc-800 shrink-0" />}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate group-hover:text-blue-400 transition-colors">{company.name}</h3>
            <div className="flex items-center gap-1.5">
              <span className="badge bg-blue-500/20 text-blue-400 text-[10px]">{company.batch}</span>
              {company.is_hiring ? <span className="badge bg-emerald-500/20 text-emerald-400 text-[10px]">Hiring</span> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {company.relevance_score > 0 && (
            <span className={`badge text-[10px] ${company.relevance_score > 60 ? 'bg-emerald-500/20 text-emerald-400' : company.relevance_score > 30 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'}`}>
              {company.relevance_score}
            </span>
          )}
          {company.outreach_status && <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot[company.outreach_status] || ''}`} />}
        </div>
      </div>
      <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{company.one_liner}</p>
      <div className="flex items-center justify-between text-[10px] text-zinc-600">
        <div className="flex items-center gap-3">
          {company.team_size > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{company.team_size}</span>}
          {locations.length > 0 && <span className="flex items-center gap-1 truncate max-w-[120px]"><MapPin className="w-3 h-3" />{locations[0]}</span>}
        </div>
        <div className="flex gap-1">
          {industries.slice(0, 2).map(i => <span key={i} className="badge bg-zinc-800 text-zinc-500 text-[10px]">{i}</span>)}
        </div>
      </div>
    </div>
  )
}
