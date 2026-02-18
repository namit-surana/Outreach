import { useState, useEffect } from 'react'
import { Search, Filter, RefreshCw, Mail, Linkedin, Github } from 'lucide-react'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [totalContacts, setTotalContacts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [stats, setStats] = useState({
    by_source: {}
  })

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('per_page', 30)
      
      if (search) params.append('search', search)
      if (source) params.append('source', source)
      
      const response = await fetch(`/api/contacts?${params.toString()}`)
      const data = await response.json()
      
      setContacts(data.contacts)
      setTotalContacts(data.total)
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const data = await response.json()
      
      // Extract contact sources from the response
      const sources = {}
      if (data.contacts_by_source) {
        setStats({ by_source: data.contacts_by_source })
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  useEffect(() => {
    fetchContacts()
    fetchStats()
  }, [page, source])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContacts()
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleSourceFilter = (newSource) => {
    setSource(source === newSource ? '' : newSource)
    setPage(1)
  }
  
  const handleRefresh = () => {
    fetchContacts()
    fetchStats()
  }

  const getSourceIcon = (src) => {
    switch(src) {
      case 'github':
        return <Github size={16} className="text-gray-600" />
      case 'linkedin_search':
        return <Linkedin size={16} className="text-blue-600" />
      case 'email_pattern':
        return <Mail size={16} className="text-orange-600" />
      case 'yc_profile':
        return <span className="text-orange-500 font-bold">YC</span>
      default:
        return <span className="text-gray-500 text-xs">{src}</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold">Contacts</h1>
        
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search contacts..."
              className="pl-8 pr-4 py-2 border rounded-md w-full sm:w-64"
              value={search}
              onChange={handleSearch}
            />
          </div>
          
          <button 
            onClick={handleRefresh} 
            className="p-2 rounded-md hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw size={20} className={loading ? "animate-spin text-blue-500" : ""} />
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 pb-4 border-b">
        <span className="text-sm text-gray-500 self-center mr-2">Filter by source:</span>
        {Object.entries(stats.by_source || {}).map(([src, count]) => (
          <button
            key={src}
            onClick={() => handleSourceFilter(src)}
            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
              source === src 
                ? 'bg-blue-100 border-blue-300 border text-blue-800' 
                : 'bg-gray-100 hover:bg-gray-200 border border-transparent'
            }`}
          >
            {getSourceIcon(src)}
            <span>{src.replace('_', ' ')}</span>
            <span className="text-xs bg-gray-200 text-gray-800 rounded-full px-1.5">{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No contacts found. Try adjusting your filters or add new contacts.
        </div>
      ) : (
        <div>
          <div className="text-sm text-gray-500 mb-4">
            Showing {contacts.length} of {totalContacts} contacts
          </div>
          
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Links</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contacts.map(contact => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{contact.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.company_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.role || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                          <Mail size={14} />
                          {contact.email}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1.5">
                        {getSourceIcon(contact.source)}
                        <span>{contact.source?.replace('_', ' ') || 'manual'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {contact.linkedin_url && (
                        <a 
                          href={contact.linkedin_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 inline-block mr-2"
                        >
                          <Linkedin size={18} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalContacts > 30 && (
            <div className="flex justify-center mt-6">
              <nav className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-3 py-1 rounded ${
                    page === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Previous
                </button>
                
                <span className="px-3 py-1 text-gray-700">
                  Page {page} of {Math.ceil(totalContacts / 30)}
                </span>
                
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalContacts / 30)}
                  className={`px-3 py-1 rounded ${
                    page >= Math.ceil(totalContacts / 30) ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </div>
      )}
    </div>
  )
}