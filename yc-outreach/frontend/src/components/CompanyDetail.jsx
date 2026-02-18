import { useState, useEffect } from 'react'
import { api } from '../api'
import { useToast } from './ToastContext'
import { X, ExternalLink, Copy, Plus, Trash2, Loader2, Mail, User, Briefcase, MapPin, Users, Sparkles } from 'lucide-react'

export default function CompanyDetail({ companyId, onClose, onOutreachChange }) {
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [emails, setEmails] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', role: '', email: '', linkedin_url: '' })
  const [outreachStatus, setOutreachStatus] = useState('new')
  const [outreachNotes, setOutreachNotes] = useState('')
  const [outreachId, setOutreachId] = useState(null)
  const { addToast } = useToast()

  useEffect(() => {
    setLoading(true)
    api.getCompany(companyId).then(c => {
      setCompany(c)
      if (c.outreach?.length) {
        const latest = c.outreach[0]
        setOutreachStatus(latest.status)
        setOutreachNotes(latest.notes || '')
        setOutreachId(latest.id)
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, [companyId])

  const generateEmails = async () => {
    setEmailLoading(true)
    try {
      const data = await api.generateEmail(companyId)
      setEmails(data.emails)
    } catch (e) {
      addToast('Failed to generate emails', 'error')
    } finally {
      setEmailLoading(false)
    }
  }

  const copyEmail = (email) => {
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`)
    addToast('Email copied to clipboard')
  }

  const addContact = async () => {
    if (!contactForm.name) return
    try {
      await api.createContact({ company_id: companyId, ...contactForm })
      const c = await api.getCompany(companyId)
      setCompany(c)
      setContactForm({ name: '', role: '', email: '', linkedin_url: '' })
      setShowContactForm(false)
      addToast('Contact added')
    } catch (e) {
      addToast('Failed to add contact', 'error')
    }
  }

  const deleteContact = async (id) => {
    try {
      await api.deleteContact(id)
      setCompany(prev => ({ ...prev, contacts: prev.contacts.filter(c => c.id !== id) }))
      addToast('Contact deleted')
    } catch (e) {
      addToast('Failed to delete contact', 'error')
    }
  }

  const saveOutreach = async () => {
    try {
      if (outreachId) {
        await api.updateOutreach(outreachId, { status: outreachStatus, notes: outreachNotes })
      } else {
        const r = await api.createOutreach({ company_id: companyId, status: outreachStatus, notes: outreachNotes })
        setOutreachId(r.id)
      }
      addToast('Outreach saved')
      onOutreachChange?.()
    } catch (e) {
      addToast('Failed to save', 'error')
    }
  }

  if (loading) return (
    <Panel onClose={onClose}>
      <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
    </Panel>
  )
  if (!company) return null

  const industries = Array.isArray(company.industries) ? company.industries : []
  const tags = Array.isArray(company.tags) ? company.tags : []
  const locations = Array.isArray(company.locations) ? company.locations : []

  return (
    <Panel onClose={onClose}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          {company.logo_url && <img src={company.logo_url} alt="" className="w-12 h-12 rounded-lg bg-zinc-800" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{company.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="badge bg-blue-500/20 text-blue-400">{company.batch}</span>
              {company.is_hiring ? <span className="badge bg-emerald-500/20 text-emerald-400">Hiring</span> : null}
              {company.status === 'Active' && <span className="badge bg-emerald-500/10 text-emerald-500">Active</span>}
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex gap-3">
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener" className="btn-secondary text-xs flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Website
            </a>
          )}
          {company.yc_url && (
            <a href={company.yc_url} target="_blank" rel="noopener" className="btn-secondary text-xs flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> YC Page
            </a>
          )}
        </div>

        {/* Description */}
        <div>
          <p className="text-sm text-zinc-300">{company.one_liner}</p>
          {company.long_description && <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{company.long_description}</p>}
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {company.team_size > 0 && (
            <div className="flex items-center gap-2 text-zinc-400"><Users className="w-4 h-4" /> {company.team_size} people</div>
          )}
          {locations.length > 0 && (
            <div className="flex items-center gap-2 text-zinc-400"><MapPin className="w-4 h-4" /> {locations.join(', ')}</div>
          )}
        </div>

        {/* Tags */}
        {(industries.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {industries.map(i => <span key={i} className="badge bg-zinc-800 text-zinc-400">{i}</span>)}
            {tags.map(t => <span key={t} className="badge bg-zinc-800/50 text-zinc-500">{t}</span>)}
          </div>
        )}

        <hr className="border-zinc-800" />

        {/* Contacts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Contacts</h3>
              {company.contacts?.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">
                  {company.contacts.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowContactForm(!showContactForm)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
          
          {showContactForm && (
            <div className="card mb-3 space-y-2 fade-in">
              <input className="input w-full" placeholder="Name" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} />
              <input className="input w-full" placeholder="Role" value={contactForm.role} onChange={e => setContactForm(p => ({ ...p, role: e.target.value }))} />
              <input className="input w-full" placeholder="Email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} />
              <input className="input w-full" placeholder="LinkedIn URL" value={contactForm.linkedin_url} onChange={e => setContactForm(p => ({ ...p, linkedin_url: e.target.value }))} />
              <div className="flex gap-2">
                <button onClick={addContact} className="btn-primary text-xs">Save</button>
                <button onClick={() => setShowContactForm(false)} className="btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          )}

          {company.contacts?.length > 0 ? (
            <>
              {/* Source filtering */}
              <div className="flex flex-wrap gap-1 mb-3">
                {Array.from(new Set(company.contacts.map(c => c.source || 'manual'))).map(source => (
                  <div key={source} className="inline-flex items-center">
                    <SourceBadge source={source} />
                  </div>
                ))}
              </div>
            
              <div className="space-y-2">
                {company.contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{c.name}</span>
                        {c.role && <span className="text-xs text-zinc-500">{c.role}</span>}
                        {c.source && <SourceBadge source={c.source} />}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {c.email}
                          </a>
                        )}
                        {c.linkedin_url && (
                          <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"></path>
                            </svg>
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteContact(c.id)} className="text-zinc-600 hover:text-red-400 shrink-0 ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              
              {/* Run Recon Agent recommendation */}
              {company.contacts.length < 2 && (
                <div className="mt-3 bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">
                    <span className="text-amber-400">Tip:</span> You can find more contacts by running the Recon agent on the Agents page.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 text-center">
              <p className="text-sm text-zinc-500 mb-2">No contacts yet</p>
              <p className="text-xs text-zinc-600">
                Add contacts manually or run the Recon agent to automatically discover contacts for this company.
              </p>
            </div>
          )}
        </div>

        <hr className="border-zinc-800" />

        {/* Email Generator */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4" /> Email Generator</h3>
          <button onClick={generateEmails} disabled={emailLoading} className="btn-primary text-xs flex items-center gap-2">
            {emailLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
            Generate Emails
          </button>
          {emails && (
            <div className="mt-3 space-y-3">
              {emails.map((e, i) => (
                <div key={i} className="card fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-400">{e.variant}</span>
                    <button onClick={() => copyEmail(e)} className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 font-medium mb-1">Subject: {e.subject}</p>
                  <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed">{e.body}</pre>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="border-zinc-800" />

        {/* Outreach */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Briefcase className="w-4 h-4" /> Outreach</h3>
          <div className="space-y-3">
            <select value={outreachStatus} onChange={e => setOutreachStatus(e.target.value)} className="input w-full">
              <option value="new">New</option>
              <option value="drafted">Drafted</option>
              <option value="sent">Sent</option>
              <option value="replied">Replied</option>
              <option value="interview">Interview</option>
            </select>
            <textarea className="input w-full h-20 resize-none" placeholder="Notes..." value={outreachNotes} onChange={e => setOutreachNotes(e.target.value)} />
            <button onClick={saveOutreach} className="btn-primary text-xs">Save Outreach</button>
          </div>
        </div>
      </div>
    </Panel>
  )
}

const SOURCE_STYLES = {
  yc_profile: { label: 'YC Profile', className: 'bg-blue-500/20 text-blue-400' },
  github: { label: 'GitHub', className: 'bg-zinc-600/30 text-zinc-300' },
  email_pattern: { label: 'Email Pattern', className: 'bg-amber-500/20 text-amber-400' },
  linkedin_search: { label: 'LinkedIn', className: 'bg-purple-500/20 text-purple-400' },
  recon_agent: { label: 'Recon', className: 'bg-emerald-500/20 text-emerald-400' },
  website_scrape: { label: 'Website', className: 'bg-cyan-500/20 text-cyan-400' },
}

function SourceBadge({ source }) {
  const style = SOURCE_STYLES[source] || { label: source, className: 'bg-zinc-700 text-zinc-400' }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${style.className}`}>{style.label}</span>
}

function Panel({ onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-zinc-900 border-l border-zinc-800 z-50 overflow-y-auto slide-in">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex justify-end z-10">
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </>
  )
}
