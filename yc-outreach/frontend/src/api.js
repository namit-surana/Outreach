const API = 'http://localhost:8000/api'

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  getCompanies: (params) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v)
    })
    return request(`/companies?${qs}`)
  },
  getCompany: (id) => request(`/companies/${id}`),
  generateEmail: (id) => request(`/companies/${id}/generate-email`, { method: 'POST' }),
  
  createContact: (data) => request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),
  
  createOutreach: (data) => request('/outreach', { method: 'POST', body: JSON.stringify(data) }),
  updateOutreach: (id, data) => request(`/outreach/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOutreach: (id) => request(`/outreach/${id}`, { method: 'DELETE' }),
  
  getStats: () => request('/stats'),
  triggerScrape: () => request('/scrape', { method: 'POST' }),

  // Agents
  runAllAgents: () => request('/agents/run', { method: 'POST' }),
  runAgent: (name) => request(`/agents/run/${name}`, { method: 'POST' }),
  getAgentLogs: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v)
    })
    return request(`/agents/logs?${qs}`)
  },
  getAgentStatus: () => request('/agents/status'),
}
