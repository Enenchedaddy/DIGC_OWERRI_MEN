import { createClient } from '@supabase/supabase-js';

let inMemoryToken: string | null = null;

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://meuzpspvpybaglbrjfxq.supabase.co';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_zXRUSNWh7gFqY7zzZK4k1A_RUe31wta';
const productionApiBase = `${supabaseUrl}/functions/v1/portal-api`;
const apiBase =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : productionApiBase);

const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  if (!token) {
    void supabase.auth.signOut({ scope: 'local' });
  }
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (apiBase) {
    headers.set('apikey', supabasePublishableKey);
  }
  if (typeof window !== 'undefined' && window.self !== window.top) {
    headers.set('X-Embedded-Context', '1');
  }

  if (!headers.has('Authorization')) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || inMemoryToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    credentials: apiBase ? 'omit' : 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!response.ok) {
      throw new ApiError('Unable to export CSV records.', response.status);
    }
    return (await response.text()) as unknown as T;
  }

  const payload = contentType.includes('application/json')
    ? ((await response.json()) as Record<string, unknown>)
    : {};

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : response.status === 404 && path.startsWith('/api/')
          ? 'The application API route is unavailable.'
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  if (
    typeof payload.token === 'string' &&
    typeof payload.refresh_token === 'string' &&
    ['/api/auth/login', '/api/auth/register', '/api/auth/bootstrap-admin'].includes(path)
  ) {
    const { error } = await supabase.auth.setSession({
      access_token: payload.token,
      refresh_token: payload.refresh_token,
    });
    if (error) throw new ApiError('Unable to persist the authenticated session.', 500);
    inMemoryToken = payload.token;
  }

  if (path === '/api/auth/logout') {
    await supabase.auth.signOut({ scope: 'local' });
    inMemoryToken = null;
  }

  return payload as T;
}
