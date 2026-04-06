const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// ADR-052: API key stored in localStorage, sent on mutating requests
function getApiKey(): string | null {
  return localStorage.getItem('jernkorset_api_key')
}

export function setApiKey(key: string): void {
  localStorage.setItem('jernkorset_api_key', key)
}

export function clearApiKey(): void {
  localStorage.removeItem('jernkorset_api_key')
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Send API key on mutating requests and exports
  const method = options?.method?.toUpperCase()
  if (method === 'PUT' || method === 'POST' || method === 'DELETE' || path.startsWith('/export')) {
    const key = getApiKey()
    if (key) headers['X-API-Key'] = key
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  })

  if (res.status === 401) {
    throw new Error('AUTH_REQUIRED')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || err.detail || err.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' })
}

// ADR-051: Trigger file download from export endpoint
export function downloadExport(path: string): void {
  const key = getApiKey()
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)
  // For download, we open in a new tab (API key via header won't work for direct navigation)
  // Instead use a fetch + blob approach
  fetch(url.toString(), {
    headers: key ? { 'X-API-Key': key } : {},
  })
    .then(res => {
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      return res.blob()
    })
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const disposition = 'jernkorset-data.zip'
      a.download = disposition
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    })
    .catch(err => alert(`Download fejlede: ${err.message}`))
}
