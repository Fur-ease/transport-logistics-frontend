const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export function getFileUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('storage/')) return `${origin}/${clean}`;
  return `${origin}/storage/${clean}`;
}

export async function openProtectedFile(path?: string | null): Promise<void> {
  const url = getFileUrl(path);
  if (!url) throw new Error('No file path provided');

  // Open immediately to preserve user gesture ("flash") and avoid popup blocking
  const win = window.open('', '_blank');
  if (!win) throw new Error('Popup blocked. Allow popups to view receipts.');

  const token = getAuthToken();
  const withAuth = async (target: string) => {
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(target, { headers, credentials: 'include' });
    if (!response.ok) throw new ApiError(`Failed to open file (${response.status})`, response.status);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    win.location.replace(objectUrl);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  try {
    await withAuth(url);
  } catch (err) {
    // Fallback: some deployments protect /storage via API route
    try {
      const alt = url.replace(/\/storage\//, '/api/v1/storage/');
      if (alt !== url) {
        await withAuth(alt);
        return;
      }
    } catch {}
    // If fetch is blocked (CORS/network), fall back to direct navigation
    if (err instanceof TypeError) {
      win.location.replace(url);
      return;
    }
    try { win.close(); } catch {}
    if (err instanceof Error) throw err;
    throw new Error('Failed to open receipt');
  }
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('haultrack_token');
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('haultrack_token', token);
  }
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('haultrack_token');
    localStorage.removeItem('haultrack_user');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      clearAuthToken();
      window.location.href = '/login';
    }

    const message = (isJson && data?.message) || `Request failed with status ${response.status}`;
    const errors = isJson && data?.errors ? data.errors : undefined;
    throw new ApiError(message, response.status, errors);
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | undefined | null>) => {
    let url = endpoint;
    if (params) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          search.append(k, String(v));
        }
      });
      const qs = search.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }
    return request<T>(url, { method: 'GET' });
  },

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  upload: <T>(endpoint: string, formData: FormData) =>
    request<T>(endpoint, {
      method: 'POST',
      body: formData,
    }),
};

