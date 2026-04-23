// Client-side helpers para chamar os endpoints do delivery.
// Todos retornam { ok, data, error } padronizado.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

function extractError(body: any): string {
  if (!body) return 'Erro na requisição';
  // Server wrapper retorna { error: { message, details } } ou { error: 'string' } ou { message: 'string' }
  const raw = body.error ?? body.message;
  if (!raw) return 'Erro na requisição';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && typeof raw.message === 'string') return raw.message;
  return 'Erro na requisição';
}

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: extractError(body), status: res.status };
    }
    return { ok: true, data: body.data };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Falha de rede', status: 0 };
  }
}

export const deliveryApi = {
  info: () => call<any>(`/api/v1/delivery/info`),
  menu: () => call<{ categories: any[] }>(`/api/v1/delivery/menu`),
  requestOtp: (phone: string) =>
    call<{ expiresAt: string; debugCode?: string }>(`/api/v1/delivery/auth/request-otp`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone: string, code: string, name?: string) =>
    call<{ token: string; customer: any }>(`/api/v1/delivery/auth/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ phone, code, name }),
    }),
  me: () => call<{ customer: any }>(`/api/v1/delivery/auth/me`),
  logout: () => call<any>(`/api/v1/delivery/auth/me`, { method: 'POST' }),
  listAddresses: () => call<{ addresses: any[] }>(`/api/v1/delivery/addresses`),
  createAddress: (data: any) =>
    call<{ id: string; lat: number | null; lng: number | null }>(`/api/v1/delivery/addresses`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteAddress: (id: string) =>
    call<any>(`/api/v1/delivery/addresses/${id}`, { method: 'DELETE' }),
  lookupZip: (cep: string) => call<any>(`/api/v1/delivery/zipcode/${cep.replace(/\D/g, '')}`),
  quote: (data: any) =>
    call<any>(`/api/v1/delivery/quote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createOrder: (data: any) =>
    call<{ order: any }>(`/api/v1/delivery/orders`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getOrder: (id: string) => call<{ order: any }>(`/api/v1/delivery/orders/${id}`),
  listOrders: () => call<{ orders: any[] }>(`/api/v1/delivery/orders`),
  pushSubscribe: (data: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) =>
    call<{ id: string }>(`/api/v1/delivery/push/subscribe`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCEP(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
