// FCM push notifications via Firebase Admin SDK.
// Requer a variável FIREBASE_SERVICE_ACCOUNT (JSON string da service account).
// Sem ela, todas as funções são no-op silenciosas.

import { prisma } from '@/lib/prisma';

let _messaging: any = null;

async function getMessaging(): Promise<any> {
  if (_messaging) return _messaging;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const admin = await import('firebase-admin');
    const sdk = admin.default ?? admin;
    if (!sdk.apps.length) {
      sdk.initializeApp({ credential: sdk.credential.cert(JSON.parse(raw)) });
    }
    _messaging = sdk.messaging();
    return _messaging;
  } catch (e) {
    console.error('[FCM] init failed:', e);
    return null;
  }
}

export const statusFcmTemplates: Record<string, (n: number) => { title: string; body: string }> = {
  accepted:   (n) => ({ title: 'Pedido confirmado ✅', body: `Pedido #${n} aceito — entrará em preparo em breve.` }),
  preparing:  (n) => ({ title: 'Em preparo 👨‍🍳', body: `Seu pedido #${n} está sendo preparado!` }),
  ready:      (n) => ({ title: 'Pedido pronto! 📦', body: `Pedido #${n} pronto para sair.` }),
  dispatched: (n) => ({ title: 'Saiu para entrega 🛵', body: `Pedido #${n} está a caminho!` }),
  delivered:  (n) => ({ title: 'Entregue ✨', body: `Pedido #${n} entregue. Bom apetite!` }),
  cancelled:  (n) => ({ title: 'Pedido cancelado', body: `Pedido #${n} foi cancelado.` }),
};

export async function sendFcmToCustomer(params: {
  unitId: string;
  customerId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  const msg = await getMessaging();
  if (!msg) return;

  const rows = await (prisma as any).fcmToken.findMany({
    where: { unitId: params.unitId, customerId: params.customerId },
    select: { token: true },
  });
  if (!rows.length) return;

  const tokens: string[] = rows.map((r: any) => r.token);

  try {
    const response = await msg.sendEachForMulticast({
      tokens,
      notification: { title: params.title, body: params.body },
      data: params.data || {},
      android: { priority: 'high', notification: { sound: 'default', channelId: 'orders' } },
    });

    const dead: string[] = [];
    response.responses.forEach((r: any, i: number) => {
      if (!r.success) {
        const code: string = r.error?.code ?? '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
          dead.push(tokens[i]);
        }
      }
    });
    if (dead.length) {
      await (prisma as any).fcmToken.deleteMany({ where: { token: { in: dead } } });
    }
  } catch (e) {
    console.error('[FCM] send error:', e);
  }
}
