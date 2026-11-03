const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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

