const ENGINE_ORIGIN = 'http://127.0.0.1:7341'
let tokenPromise: Promise<string> | null = null
let nativeFetch: typeof window.fetch | null = null

function tokenRequest(): Promise<string> {
  if (!nativeFetch) return Promise.resolve('')
  return nativeFetch(`${ENGINE_ORIGIN}/auth/token`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(data => String((data as { token?: string } | null)?.token || ''))
    .catch(() => '')
}

function getToken(): Promise<string> {
  if (!tokenPromise) tokenPromise = tokenRequest()
  return tokenPromise
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input instanceof Request ? input.url : ''
}

function isEngineRequest(input: RequestInfo | URL): boolean {
  return requestUrl(input).startsWith(ENGINE_ORIGIN)
}

if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  nativeFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!nativeFetch || !isEngineRequest(input)) {
      return (nativeFetch || window.fetch)(input, init)
    }
    const token = await getToken()
    if (!token) return nativeFetch(input, init)
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
    headers.set('X-Haibara-Token', token)
    let response = await nativeFetch(input, { ...init, headers })
    if (response.status === 401) {
      tokenPromise = null
      const retryToken = await getToken()
      if (retryToken) {
        headers.set('X-Haibara-Token', retryToken)
        response = await nativeFetch(input, { ...init, headers })
      }
    }
    return response
  }
}

export {}
