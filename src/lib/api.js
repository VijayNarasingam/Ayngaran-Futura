/**
 * Frontend SQL client - thin fetch wrapper over the /api/* SQL server.
 * Same collection names as before: marketers, projects, bookings, loans, vouchers.
 */

const request = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${response.status})`)
  }
  return response.json()
}

export const fetchState = () => request('/api/state')

export const listRecords = (collection) => request(`/api/${collection}`)

export const createRecord = (collection, values) =>
  request(`/api/${collection}`, { method: 'POST', body: JSON.stringify(values || {}) })

export const updateRecord = (collection, id, values) =>
  request(`/api/${collection}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(values || {}),
  })

export const deleteRecord = (collection, id) =>
  request(`/api/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' })
