// Polling worker de eventos iFood.
// - Faz polling a cada IFOOD_POLLING_INTERVAL_MS
// - Persiste cada evento em IfoodEvent (idempotência via @unique ifoodEventId)
// - Processa: PLC -> cria pedido local, CAN -> cancela, DSP/CON -> atualiza status
// - Acknowledge em lote após processamento

import { prisma } from '@/lib/prisma';
import { ifoodFetch, isIfoodConfigured, IfoodConfigError } from './client';
import { fetchIfoodOrder, upsertOrderFromIfood, cancelIfoodOrderLocally } from './orders';
import type { IfoodEventDTO } from './types';

const POLL_PATH = '/events/v1.0/events:polling';
const ACK_PATH = '/events/v1.0/events/acknowledgment';
const DEFAULT_INTERVAL = 30000;

let running = false;
let stopped = true;

export function isPollingRunning(): boolean {
  return !stopped;
}

/**
 * Inicia o loop de polling. Chamar uma única vez no bootstrap do servidor.
 */
export function startIfoodPolling() {
  if (!stopped) return; // já está rodando
  if (!isIfoodConfigured()) {
    console.log('[iFood] Credenciais não configuradas. Polling desativado.');
    return;
  }

  stopped = false;
  const interval = Number(process.env.IFOOD_POLLING_INTERVAL_MS || DEFAULT_INTERVAL);
  console.log(`[iFood] Polling iniciado (intervalo: ${interval}ms)`);

  const loop = async () => {
    if (stopped) return;
    if (!running) {
      running = true;
      try {
        await pollOnce();
      } catch (err: any) {
        if (err instanceof IfoodConfigError) {
          console.warn('[iFood]', err.message);
        } else {
          console.error('[iFood] Erro no polling:', err?.message || err);
        }
      } finally {
        running = false;
      }
    }
    setTimeout(loop, interval);
  };

  loop();
}

export function stopIfoodPolling() {
  stopped = true;
  console.log('[iFood] Polling parado.');
}

/**
 * Executa uma iteração: busca eventos, persiste, processa e acknowledga.
 */
export async function pollOnce() {
  const events = await ifoodFetch<IfoodEventDTO[] | null>(POLL_PATH, { method: 'GET' });
  if (!events || events.length === 0) return;

  console.log(`[iFood] ${events.length} evento(s) recebido(s).`);
  const acks: string[] = [];

  for (const evt of events) {
    try {
      const unitId = await resolveUnitIdByMerchant(evt.merchantId);
      if (!unitId) {
        // Sem Unit associada a esse merchant: reconhecer e ignorar
        acks.push(evt.id);
        await saveEvent(evt, null, 'ignored', 'merchantId sem Unit associada');
        continue;
      }

      // Persiste evento (idempotente via unique ifoodEventId)
      const stored = await saveEvent(evt, unitId, 'pending');
      if (!stored) {
        // já existia, só reconhece novamente
        acks.push(evt.id);
        continue;
      }

      await processEvent(unitId, evt);
      await prisma.ifoodEvent.update({
        where: { id: stored.id },
        data: { status: 'processed', processedAt: new Date() },
      });
      acks.push(evt.id);
    } catch (err: any) {
      console.error(`[iFood] Falha ao processar evento ${evt.id}:`, err?.message || err);
      await prisma.ifoodEvent
        .updateMany({
          where: { ifoodEventId: evt.id },
          data: { status: 'failed', errorMessage: String(err?.message || err) },
        })
        .catch(() => {});
      // Não reconhece (será reenviado pelo iFood)
    }
  }

  if (acks.length > 0) {
    try {
      await ifoodFetch(ACK_PATH, {
        method: 'POST',
        body: JSON.stringify(acks.map((id) => ({ id }))),
      });
      await prisma.ifoodEvent.updateMany({
        where: { ifoodEventId: { in: acks } },
        data: { acknowledgedAt: new Date() },
      });
    } catch (err: any) {
      console.error('[iFood] Falha ao acknowledgar eventos:', err?.message || err);
    }
  }
}

async function saveEvent(
  evt: IfoodEventDTO,
  unitId: string | null,
  status: 'pending' | 'ignored' | 'processed' | 'failed',
  errorMessage?: string,
) {
  try {
    return await prisma.ifoodEvent.create({
      data: {
        unitId: unitId || '',
        ifoodEventId: evt.id,
        ifoodOrderId: evt.orderId,
        code: evt.code,
        fullCode: evt.fullCode,
        payload: JSON.stringify(evt),
        status,
        errorMessage,
      },
    });
  } catch (err: any) {
    // Unique violation: evento já registrado antes
    if (err?.code === 'P2002') return null;
    throw err;
  }
}

async function resolveUnitIdByMerchant(merchantId?: string): Promise<string | null> {
  if (!merchantId) return null;
  const unit = await prisma.unit.findFirst({
    where: { ifoodMerchantId: merchantId, ifoodEnabled: true } as any,
    select: { id: true },
  });
  return unit?.id || null;
}

async function processEvent(unitId: string, evt: IfoodEventDTO) {
  const code = (evt.fullCode || evt.code || '').toUpperCase();

  // PLC / PLACED: novo pedido
  if (code === 'PLC' || code === 'PLACED') {
    const dto = await fetchIfoodOrder(evt.orderId);
    const { created, order } = await upsertOrderFromIfood(unitId, dto);

    // Auto-confirm se a unidade estiver configurada para isso
    if (created) {
      const unit = await prisma.unit.findUnique({ where: { id: unitId } }) as any;
      if (unit?.ifoodAutoConfirm) {
        try {
          await ifoodFetch(`/order/v1.0/orders/${evt.orderId}/confirm`, { method: 'POST' });
          await prisma.order.update({
            where: { id: order.id },
            data: { ifoodStatus: 'CONFIRMED', status: 'accepted', acceptedAt: new Date() },
          });
        } catch (err: any) {
          console.error('[iFood] Auto-confirm falhou:', err?.message || err);
        }
      }
    }
    return;
  }

  // CAN / CANCELLED: cancelamento
  if (code === 'CAN' || code === 'CANCELLED' || code === 'CANCELLATION_REQUESTED') {
    await cancelIfoodOrderLocally(evt.orderId, (evt.metadata as any)?.reason);
    return;
  }

  // CFM / CONFIRMED / DSP / CON: apenas atualiza status textual
  if (['CFM', 'CONFIRMED', 'DSP', 'DISPATCHED', 'CON', 'CONCLUDED', 'RPR', 'READY_TO_PICKUP'].includes(code)) {
    await prisma.order.updateMany({
      where: { ifoodOrderId: evt.orderId } as any,
      data: { ifoodStatus: code },
    });
    return;
  }

  // Outros eventos: apenas registrados (status=processed)
}
