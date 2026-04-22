const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (typeof payload === 'object' && payload && 'detail' in payload) {
      throw new Error(String(payload.detail));
    }

    if (typeof payload === 'string' && payload.trim()) {
      throw new Error(payload);
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  return payload as T;
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });

  return parseResponse<T>(response);
}

export const api = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'GET' });
  },

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE' });
  },

  postForm<T>(endpoint: string, formData: FormData): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  },
};
