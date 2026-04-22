// Gestão do status da loja no iFood (abrir/fechar/pausar).
// Endpoints: /merchant/v1.0/merchants/{merchantId}/status
//            /merchant/v1.0/merchants/{merchantId}/interruptions

import { prisma } from '@/lib/prisma';
import { ifoodFetch } from './client';
import type { IfoodMerchantStatus } from './types';

const MERCHANT_PATH = '/merchant/v1.0/merchants';

async function getMerchantId(unitId: string): Promise<string> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } }) as any;
  if (!unit?.ifoodMerchantId) {
    throw new Error('Unidade sem merchantId iFood configurado');
  }
  return unit.ifoodMerchantId;
}

/**
 * Consulta o status atual da loja no iFood.
 */
export async function fetchMerchantStatus(unitId: string): Promise<IfoodMerchantStatus[]> {
  const merchantId = await getMerchantId(unitId);
  const data = await ifoodFetch<IfoodMerchantStatus[]>(`${MERCHANT_PATH}/${merchantId}/status`);
  return Array.isArray(data) ? data : [data as any];
}

/**
 * Atualiza cache local do status da loja (campo ifoodStoreStatus na Unit).
 */
export async function refreshMerchantStatus(unitId: string) {
  try {
    const statuses = await fetchMerchantStatus(unitId);
    // iFood retorna array com validações por canal (DELIVERY, TAKEOUT, INDOOR).
    // Consideramos "open" se algum canal estiver AVAILABLE.
    const hasOpen = statuses.some(
      (s) => s.state === 'AVAILABLE' || s.state === 'OPEN' || (s as any).available,
    );
    const newStatus = hasOpen ? 'open' : 'closed';
    await (prisma.unit as any).update({
      where: { id: unitId },
      data: { ifoodStoreStatus: newStatus, ifoodLastPollAt: new Date() },
    });
    return { status: newStatus, details: statuses };
  } catch (err: any) {
    await (prisma.unit as any).update({
      where: { id: unitId },
      data: { ifoodStoreStatus: 'unknown', ifoodLastPollAt: new Date() },
    });
    throw err;
  }
}

/**
 * Cria uma pausa (interruption) na loja.
 * Útil para pausar temporariamente quando a cozinha estiver sobrecarregada.
 */
export async function pauseMerchant(unitId: string, durationMinutes: number, description = 'Pausa operacional') {
  const merchantId = await getMerchantId(unitId);
  const now = new Date();
  const end = new Date(now.getTime() + durationMinutes * 60_000);
  return ifoodFetch(`${MERCHANT_PATH}/${merchantId}/interruptions`, {
    method: 'POST',
    body: JSON.stringify({
      description,
      start: now.toISOString(),
      end: end.toISOString(),
    }),
  });
}

/**
 * Remove uma interruption pelo id.
 */
export async function resumeMerchant(unitId: string, interruptionId: string) {
  const merchantId = await getMerchantId(unitId);
  return ifoodFetch(`${MERCHANT_PATH}/${merchantId}/interruptions/${interruptionId}`, {
    method: 'DELETE',
  });
}

/**
 * Lista interruptions ativas.
 */
export async function listInterruptions(unitId: string) {
  const merchantId = await getMerchantId(unitId);
  return ifoodFetch(`${MERCHANT_PATH}/${merchantId}/interruptions`);
}
