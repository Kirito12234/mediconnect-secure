import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send/receive httpOnly auth + CSRF cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// In-memory CSRF token, refreshed via fetchCsrfToken()
let csrfToken: string | null = null;

export const setCsrfToken = (token: string | null): void => {
  csrfToken = token;
};

/**
 * Fetch a fresh CSRF token from the backend and cache it for future
 * state-changing requests.
 */
export const fetchCsrfToken = async (): Promise<string> => {
  const { data } = await api.get<{ csrfToken: string }>('/auth/csrf-token');
  csrfToken = data.csrfToken;
  return data.csrfToken;
};

// Request interceptor: attach CSRF token on mutating requests
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const method = (config.method || 'get').toUpperCase();
    const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (isMutating) {
      if (!csrfToken) {
        try {
          await fetchCsrfToken();
        } catch {
          // Allow the request to proceed; backend will reject if required.
        }
      }
      if (csrfToken) {
        config.headers.set('X-CSRF-Token', csrfToken);
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle auth/session errors centrally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;

    // Only redirect on 401 (unauthenticated). Let components handle 403/423/429
    // so they can show contextual messages (e.g. lockout, password expired).
    if (status === 401) {
      csrfToken = null;
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
