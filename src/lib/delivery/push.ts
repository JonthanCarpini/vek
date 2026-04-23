// Web Push (VAPID) — wrapper sobre a lib `web-push`.
// As chaves VAPID são armazenadas por Unit no banco (configuradas via UI admin).
// Uma subscription inválida (410/404) é removida automaticamente da base.

import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  /** Dados livres que serão entregues ao service worker */
  data?: Record<string, any>;
}

/**
 * Gera um par de chaves VAPID para o admin configurar uma nova unit.
 * Deve ser chamado apenas via endpoint autenticado.
 */
export function generateVapidKeys() {
  return webpush.generateVAPIDKeys();
}

interface UnitVapid {
  pushVapidPublicKey: string | null;
  pushVapidPrivateKey: string | null;
  pushVapidSubject: string | null;
}

function hasVapid(unit: UnitVapid): boolean {
  return !!(unit.pushVapidPublicKey && unit.pushVapidPrivateKey && unit.pushVapidSubject);
}

/**
 * Dispara notificação push para todas as subscriptions elegíveis.
 * @param filter subscriptions que devem receber (customerId ou array de endpoints).
 */
export async function sendPushToCustomer(params: {
  unitId: string;
  customerId: string;
  payload: PushPayload;
}): Promise<{ sent: number; failed: number }> {
  const { unitId, customerId, payload } = params;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      pushVapidPublicKey: true,
      pushVapidPrivateKey: true,
      pushVapidSubject: true,
    } as any,
  }) as UnitVapid | null;

  if (!unit || !hasVapid(unit)) {
    return { sent: 0, failed: 0 }; // silenciosamente no-op se admin não configurou
  }

  webpush.setVapidDetails(
    unit.pushVapidSubject!,
    unit.pushVapidPublicKey!,
    unit.pushVapidPrivateKey!,
  );

  const subs = await prisma.pushSubscription.findMany({
    where: { unitId, customerId },
  });

  if (subs.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0, failed = 0;
  const deadEndpoints: string[] = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }, body);
      sent++;
    } catch (e: any) {
      failed++;
      // 404 Not Found / 410 Gone = subscription expirada → remover
      const code = e?.statusCode;
      if (code === 404 || code === 410) {
        deadEndpoints.push(s.endpoint);
      }
      console.error('[push] falha endpoint', s.endpoint.slice(-30), code);
    }
  }));

  if (deadEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: deadEndpoints } },
    });
  }

  return { sent, failed };
}

/**
 * Payloads padronizados para as transições de status do pedido delivery.
 */
export const statusPushTemplates: Record<string, (orderNumber: number) => PushPayload> = {
  accepted: (n) => ({
    title: 'Pedido confirmado ✅',
    body: `Seu pedido #${n} foi aceito e entrará em preparo.`,
    tag: `order-${n}-accepted`,
  }),
  preparing: (n) => ({
    title: 'Em preparo 👨‍🍳',
    body: `Estamos preparando seu pedido #${n}.`,
    tag: `order-${n}-preparing`,
  }),
  ready: (n) => ({
    title: 'Pedido pronto! 📦',
    body: `Seu pedido #${n} está pronto para sair.`,
    tag: `order-${n}-ready`,
  }),
  dispatched: (n) => ({
    title: 'Saiu para entrega 🛵',
    body: `Seu pedido #${n} está a caminho. Acompanhe a localização em tempo real.`,
    tag: `order-${n}-dispatched`,
  }),
  delivered: (n) => ({
    title: 'Entregue ✨',
    body: `Pedido #${n} entregue. Bom apetite!`,
    tag: `order-${n}-delivered`,
  }),
  cancelled: (n) => ({
    title: 'Pedido cancelado',
    body: `Seu pedido #${n} foi cancelado. Entre em contato para mais informações.`,
    tag: `order-${n}-cancelled`,
  }),
};
