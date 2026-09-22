/**
 * In-Memory API Cache and Centralized HTTP Client
 * 
 * Provides transparent in-memory response caching for GET requests with 1-minute TTL,
 * eliminating tab-switching loading delays (e.g. Anagrafiche -> Catalogo -> Ordini).
 * Automatically invalidates relevant entity caches on POST, PUT, PATCH, or DELETE mutations.
 */

export interface ApiCacheEntry {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  timestamp: number;
}

// 1-minute TTL as requested ("Imposta un TTL di 1 minuti")
export const CACHE_TTL_MS = 60 * 1000;

// Global in-memory Javascript Map for API GET responses
export const apiCache = new Map<string, ApiCacheEntry>();

// Map to track in-flight requests to deduplicate concurrent requests for identical URLs
const inFlightRequests = new Map<string, Promise<Response>>();

declare global {
  interface Window {
    __connectApiCacheInstalled?: boolean;
    __nativeFetch?: typeof window.fetch;
  }
}

// Preserve original native fetch reference safely
const originalFetchReference: typeof fetch = (() => {
  if (typeof window !== 'undefined') {
    if (window.__nativeFetch) return window.__nativeFetch;
    if (typeof window.fetch === 'function') {
      const bound = window.fetch.bind(window);
      window.__nativeFetch = bound;
      return bound;
    }
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
    return (input: any, init?: any) => globalThis.fetch(input, init);
  }
  return fetch;
})();

function callNativeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return originalFetchReference(input, init);
}

/**
 * Normalizes request input into an absolute URL string for consistent cache keying
 */
export function getCacheKey(input: RequestInfo | URL): string {
  let rawUrl = '';
  if (typeof input === 'string') {
    rawUrl = input;
  } else if (input instanceof URL) {
    rawUrl = input.toString();
  } else if (typeof Request !== 'undefined' && input instanceof Request) {
    rawUrl = input.url;
  } else {
    rawUrl = String(input);
  }

  if (typeof window !== 'undefined' && window.location) {
    try {
      const resolved = new URL(rawUrl, window.location.origin);
      return resolved.href;
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
}

/**
 * Determines whether a URL is an internal API endpoint eligible for caching
 */
export function isCacheableApiUrl(url: string): boolean {
  try {
    const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const path = urlObj.pathname;

    // Must be an /api/ route
    if (!path.startsWith('/api/') && !path.includes('/api/')) {
      return false;
    }

    // Do not cache real-time notification polls or auth check endpoints that need real-time ping
    if (path.includes('/api/notifications') || path.includes('/api/health')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Identifies the entity name from a URL and purges all related cached entries
 */
export function invalidateEntityCache(urlOrEntity: string): void {
  const target = urlOrEntity.toLowerCase();
  const tagsToPurge = new Set<string>();

  if (target.includes('client')) {
    tagsToPurge.add('client');
  }
  if (target.includes('product')) {
    tagsToPurge.add('product');
  }
  if (target.includes('order')) {
    tagsToPurge.add('order');
    tagsToPurge.add('stat');
  }
  if (target.includes('supplier')) {
    tagsToPurge.add('supplier');
  }
  if (target.includes('task') || target.includes('note')) {
    tagsToPurge.add('task');
    tagsToPurge.add('note');
    tagsToPurge.add('stat');
  }
  if (target.includes('user') || target.includes('login') || target.includes('logout') || target.includes('auth')) {
    tagsToPurge.add('user');
    tagsToPurge.add('me');
  }
  if (target.includes('payment')) {
    tagsToPurge.add('payment');
  }
  if (target.includes('categor')) {
    tagsToPurge.add('categor');
  }
  if (target.includes('girovisite') || target.includes('visit')) {
    tagsToPurge.add('girovisite');
    tagsToPurge.add('visit');
  }

  // Extract path segments if no predefined tags matched
  if (tagsToPurge.size === 0) {
    try {
      const urlObj = new URL(urlOrEntity, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      const segments = urlObj.pathname.split('/').filter(s => s.length >= 3 && !/^\d+$/.test(s));
      for (const s of segments) {
        if (s !== 'api' && s !== 'easyfatt') {
          tagsToPurge.add(s.toLowerCase());
        }
      }
    } catch {
      const parts = target.split(/[/_.-]/).filter(s => s.length >= 3 && !/^\d+$/.test(s));
      for (const p of parts) {
        if (p !== 'api') tagsToPurge.add(p);
      }
    }
  }

  // Delete matching entries from the cache Map
  for (const key of Array.from(apiCache.keys())) {
    const lowerKey = key.toLowerCase();
    for (const tag of tagsToPurge) {
      if (lowerKey.includes(tag)) {
        apiCache.delete(key);
        break;
      }
    }
  }
}

/**
 * Clear the entire in-memory cache
 */
export function clearApiCache(): void {
  apiCache.clear();
  inFlightRequests.clear();
}

/**
 * Creates a fresh clone of a cached Response
 */
function createResponseFromCache(entry: ApiCacheEntry): Response {
  const headers = new Headers(entry.headers);
  headers.set('X-Connect-Cache', 'HIT');
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers,
  });
}

/**
 * Central cached fetch implementation
 */
export async function cachedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
  const cacheKey = getCacheKey(input);
  const isGet = method === 'GET';
  const isApi = isCacheableApiUrl(cacheKey);

  // Check explicit cache-bypass flags
  const bypassCache = init?.cache === 'no-cache' || 
                      init?.cache === 'reload' || 
                      (init?.headers as any)?.['x-refresh'] === 'true' ||
                      (init?.headers as any)?.['X-Refresh'] === 'true';

  // 1. GET requests: check in-memory cache
  if (isGet && isApi && !bypassCache) {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_TTL_MS) {
        // Cache HIT (0ms return)
        return createResponseFromCache(cached);
      } else {
        // Expired
        apiCache.delete(cacheKey);
      }
    }

    // In-flight request deduplication: return existing pending promise if identical GET is currently executing
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight.then(res => res.clone());
    }
  }

  // Execute network request
  const fetchPromise = (async () => {
    try {
      const response = await callNativeFetch(input, init);

      // Cache GET responses if successful
      if (isGet && isApi && response.ok) {
        try {
          const clone = response.clone();
          const bodyText = await clone.text();
          const headersList: [string, string][] = [];
          response.headers.forEach((value, key) => {
            headersList.push([key, value]);
          });

          apiCache.set(cacheKey, {
            body: bodyText,
            status: response.status,
            statusText: response.statusText,
            headers: headersList,
            timestamp: Date.now(),
          });
        } catch {
          // Non-fatal cloning error, return original response
        }
      }

      // 2. Automatic Invalidation on POST, PUT, PATCH, DELETE
      if (!isGet && isApi) {
        invalidateEntityCache(cacheKey);
      }

      return response;
    } finally {
      if (isGet && isApi) {
        inFlightRequests.delete(cacheKey);
      }
    }
  })();

  if (isGet && isApi) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

/**
 * Transparent global fetch installation
 * Safely installs interceptor using Object.defineProperty to support browser environments
 * (e.g. iframe contexts) where window.fetch has only a getter or is read-only.
 */
function installGlobalFetchInterceptor() {
  if (typeof window === 'undefined') return;
  if (window.__connectApiCacheInstalled) return;

  let installed = false;

  // 1. Try Object.defineProperty on window (creates own property, bypassing prototype getter)
  try {
    Object.defineProperty(window, 'fetch', {
      value: cachedFetch,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    installed = true;
  } catch {
    // Continue to alternative approaches
  }

  // 2. Try globalThis if distinct from window
  if (!installed && typeof globalThis !== 'undefined' && globalThis !== (window as any)) {
    try {
      Object.defineProperty(globalThis, 'fetch', {
        value: cachedFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      installed = true;
    } catch {
      // Continue
    }
  }

  // 3. Try Window.prototype if instance definition was blocked
  if (!installed && typeof Window !== 'undefined' && Window.prototype) {
    try {
      Object.defineProperty(Window.prototype, 'fetch', {
        value: cachedFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      installed = true;
    } catch {
      // Continue
    }
  }

  // 4. Fallback: direct assignment inside safe try/catch
  if (!installed) {
    try {
      (window as any).fetch = cachedFetch;
      installed = true;
    } catch {
      // Gracefully prevent unhandled exception
    }
  }

  window.__connectApiCacheInstalled = true;
}

installGlobalFetchInterceptor();

/**
 * Helpers for public URL resolution and apiFetch compatibility
 */
export function getPublicApiUrl(path: string): string {
  if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'))) {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      if (path.includes('localhost:') && !window.location.hostname.includes('localhost')) {
        return path.replace(/http:\/\/localhost:\d+/, window.location.origin);
      }
    }
    return path;
  }

  const envApiUrl = (import.meta as any).env?.VITE_API_URL || 
                    (import.meta as any).env?.VITE_BACKEND_URL || 
                    (import.meta as any).env?.VITE_RAILWAY_STATIC_URL;

  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim() !== '') {
    const cleanBase = envApiUrl.trim().replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  }

  return path;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url: RequestInfo | URL = input;
  if (typeof input === 'string') {
    url = getPublicApiUrl(input);
  }

  const roleplayUser = typeof localStorage !== 'undefined' ? (localStorage.getItem('roleplay_user') || localStorage.getItem('simulation_user')) : null;
  const isRoleplay = typeof localStorage !== 'undefined' ? localStorage.getItem('is_roleplay_mode') : null;

  const customHeaders: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
  };

  if (roleplayUser && !customHeaders['x-simulation-user'] && !customHeaders['X-Simulation-User']) {
    customHeaders['X-Simulation-User'] = roleplayUser;
  }
  if (isRoleplay === 'true' && !customHeaders['x-roleplay-mode'] && !customHeaders['X-Roleplay-Mode']) {
    customHeaders['X-Roleplay-Mode'] = 'true';
  }

  const defaultInit: RequestInit = {
    credentials: 'include',
    ...init,
    headers: customHeaders,
  };

  return cachedFetch(url, defaultInit);
}

// Convenient apiClient object
export const apiClient = {
  get: (url: string, init?: RequestInit) => cachedFetch(url, { ...init, method: 'GET' }),
  post: (url: string, data?: any, init?: RequestInit) => cachedFetch(url, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
  }),
  put: (url: string, data?: any, init?: RequestInit) => cachedFetch(url, {
    ...init,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
  }),
  patch: (url: string, data?: any, init?: RequestInit) => cachedFetch(url, {
    ...init,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
  }),
  delete: (url: string, init?: RequestInit) => cachedFetch(url, { ...init, method: 'DELETE' }),
  fetch: cachedFetch,
  invalidate: invalidateEntityCache,
  clear: clearApiCache,
  cache: apiCache,
};
