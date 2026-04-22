// Cálculo de taxa de entrega e validação de área de cobertura.
// Usa fórmula de Haversine para distância em km entre dois pontos lat/lng.

import { prisma } from '@/lib/prisma';

export interface DeliveryQuote {
  distanceKm: number;
  fee: number;
  isFree: boolean;
  estimatedMinutes: number;
  outOfRange: boolean;
}

/**
 * Distância em km entre dois pontos usando Haversine.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // raio da Terra em km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcula taxa de entrega com base na unidade e ponto de destino.
 *
 * Fórmula: fee = baseFee + (distanceKm * feePerKm)
 * Se orderSubtotal >= freeOver -> fee = 0 (frete grátis)
 * Se distanceKm > maxRadiusKm -> outOfRange = true
 */
export async function calculateDeliveryFee(params: {
  unitId: string;
  customerLat: number;
  customerLng: number;
  orderSubtotal?: number;
}): Promise<DeliveryQuote> {
  const unit = await prisma.unit.findUnique({
    where: { id: params.unitId },
    select: {
      addressLat: true, addressLng: true,
      deliveryMaxRadiusKm: true, deliveryBaseFee: true,
      deliveryFeePerKm: true, deliveryFreeOver: true,
      deliveryPrepTimeMin: true, deliveryAvgTimeMin: true,
    } as any,
  }) as any;

  if (!unit?.addressLat || !unit?.addressLng) {
    throw new Error('Endereço da loja não configurado (coordenadas ausentes)');
  }

  const distanceKm = haversineKm(
    Number(unit.addressLat), Number(unit.addressLng),
    params.customerLat, params.customerLng,
  );

  const maxRadius = Number(unit.deliveryMaxRadiusKm);
  const outOfRange = distanceKm > maxRadius;

  const baseFee = Number(unit.deliveryBaseFee);
  const feePerKm = Number(unit.deliveryFeePerKm);
  let fee = Math.round((baseFee + distanceKm * feePerKm) * 100) / 100;

  // Frete grátis se pedido acima de X
  const freeOver = unit.deliveryFreeOver ? Number(unit.deliveryFreeOver) : null;
  const isFree = !!(freeOver && params.orderSubtotal && params.orderSubtotal >= freeOver);
  if (isFree) fee = 0;

  const estimatedMinutes = Number(unit.deliveryPrepTimeMin) + Number(unit.deliveryAvgTimeMin);

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    fee,
    isFree,
    estimatedMinutes,
    outOfRange,
  };
}
