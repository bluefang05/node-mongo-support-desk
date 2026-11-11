const DEMO = typeof __DEMO__ !== 'undefined' && __DEMO__

export const isDemo = () => DEMO

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })

  if (response.status === 204) return null

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`)
    error.status = response.status
    error.errors = data.errors
    throw error
  }

  return data
}

export async function api(path, options = {}) {
  if (DEMO) {
    const { handleDemoRequest } = await import('./mock.js')
    return handleDemoRequest(path, options)
  }

  return request(path, options)
}

export const formatDate = (value) =>
  value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
