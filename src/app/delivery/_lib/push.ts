// Push client helpers — roda só no browser.
// Fluxo:
//   1. checkPushSupport() — verifica se o browser suporta Push API + Notifications.
//   2. getPushConfig() — busca VAPID public key do servidor.
//   3. subscribeToPush() — registra o SW, pede permissão e cria a subscription,
//      enviando-a ao backend via /subscribe.
//   4. unsubscribeFromPush() — cancela no browser + backend.
//
// Este módulo NÃO tenta pedir permissão automaticamente para respeitar o UX do iOS
// Safari, que exige gesto do usuário.

import { deliveryApi } from './api';

const SW_URL = '/sw-push.js';
const SW_SCOPE = '/delivery';

export function checkPushSupport(): { supported: boolean; reason?: string } {
  if (typeof window === 'undefined') return { supported: false, reason: 'SSR' };
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'Service Worker não suportado' };
  if (!('PushManager' in window)) return { supported: false, reason: 'Push não suportado' };
  if (!('Notification' in window)) return { supported: false, reason: 'Notification API não suportada' };
  return { supported: true };
}

export async function getPushConfig(): Promise<{ enabled: boolean; publicKey: string | null }> {
  try {
    const res = await fetch('/api/v1/delivery/push/config');
    const body = await res.json();
    return body.data || { enabled: false, publicKey: null };
  } catch {
    return { enabled: false, publicKey: null };
  }
}

/** Verifica sem pedir permissão: existe subscription ativa neste device? */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const { supported } = checkPushSupport();
  if (!supported) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

/**
 * Pede permissão, registra o SW e cria/atualiza subscription.
 * Envia ao backend. Deve ser chamado a partir de um gesto do usuário.
 */
export async function subscribeToPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supported, reason } = checkPushSupport();
  if (!supported) return { ok: false, error: reason || 'Não suportado' };

  const config = await getPushConfig();
  if (!config.enabled || !config.publicKey) {
    return { ok: false, error: 'Notificações não habilitadas pela loja' };
  }

  // 1. Permissão
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Permissão negada' };
  }

  // 2. Registro do SW
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  await navigator.serviceWorker.ready;

  // 3. Subscription
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
    });
  }

  // 4. Envia ao backend
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) return { ok: false, error: 'Chaves da subscription ausentes' };

  const res = await deliveryApi.pushSubscribe({
    endpoint: sub.endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent,
  });
  if (!res.ok) {
    // Remove a subscription local caso o backend rejeite
    await sub.unsubscribe().catch(() => {});
    return { ok: false, error: res.error };
  }

  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await fetch('/api/v1/delivery/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

/** VAPID keys vêm em base64url; Push API exige Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
