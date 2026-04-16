'use client';

const KEY = 'md:staff';

export interface StaffAuth {
  token: string;
  user: { id: string; name: string; email: string; role: string; unitId: string | null };
}

export function saveStaff(a: StaffAuth) { localStorage.setItem(KEY, JSON.stringify(a)); }
export function loadStaff(): StaffAuth | null {
  if (typeof window === 'undefined') return null;
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function clearStaff() { localStorage.removeItem(KEY); }

export async function apiFetch(path: string, init: RequestInit = {}) {
  const a = loadStaff();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (a?.token) headers.set('Authorization', `Bearer ${a.token}`);
  const r = await fetch(path, { ...init, headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return j.data;
}
