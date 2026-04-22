// Wrapper do Google Maps Geocoding API.
// - Cache persistente em GeocodeCache (TTL: 30 dias)
// - Fallback para ViaCEP para CEPs brasileiros (sem consumir quota Google)

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const GOOGLE_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const CACHE_TTL_DAYS = 30;

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
  source: 'cache' | 'google' | 'viacep';
}

export class GeocodeError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'GeocodeError';
  }
}

/**
 * Hash normalizado para cache: remove diacríticos, espaços múltiplos, case-insensitive.
 */
function hashAddress(address: string): string {
  const normalized = address
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 32);
}

/**
 * Geocodifica um endereço textual (rua, numero, bairro, cidade, estado, CEP).
 * Verifica o cache primeiro. Se cache miss, chama Google Maps API.
 */
export async function geocodeAddress(params: {
  unitId: string;
  address: string;
  apiKey?: string;
}): Promise<GeocodeResult> {
  const { unitId, address } = params;
  if (!address || address.trim().length < 5) {
    throw new GeocodeError('Endereço muito curto', 'INVALID_ADDRESS');
  }

  const key = hashAddress(address);

  // 1. Verifica cache
  const cached = await (prisma as any).geocodeCache.findUnique({
    where: { unitId_key: { unitId, key } },
  });

  if (cached) {
    const age = Date.now() - new Date(cached.createdAt).getTime();
    if (age < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
      return {
        lat: Number(cached.lat),
        lng: Number(cached.lng),
        formatted: cached.formatted || address,
        source: 'cache',
      };
    }
  }

  // 2. Busca chave API (da unidade, fallback env)
  let apiKey = params.apiKey;
  if (!apiKey) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { googleMapsApiKey: true } as any,
    }) as any;
    apiKey = unit?.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY;
  }
  if (!apiKey) {
    throw new GeocodeError(
      'Chave Google Maps não configurada. Configure em /admin/delivery.',
      'NO_API_KEY',
    );
  }

  // 3. Chama Google Maps
  const url = new URL(GOOGLE_API_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'br');
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status === 'REQUEST_DENIED') {
    throw new GeocodeError('Chave Google Maps inválida', 'INVALID_API_KEY');
  }
  if (data.status === 'OVER_QUERY_LIMIT') {
    throw new GeocodeError('Cota Google Maps excedida', 'QUOTA_EXCEEDED');
  }
  if (data.status === 'ZERO_RESULTS' || !data.results?.[0]) {
    throw new GeocodeError('Endereço não encontrado', 'NOT_FOUND');
  }
  if (data.status !== 'OK') {
    throw new GeocodeError(`Erro na geocodificação: ${data.status}`, 'API_ERROR');
  }

  const result = data.results[0];
  const location = result.geometry.location;
  const formatted = result.formatted_address;

  // 4. Persiste no cache
  await (prisma as any).geocodeCache.upsert({
    where: { unitId_key: { unitId, key } },
    create: { unitId, key, address, lat: location.lat, lng: location.lng, formatted },
    update: { address, lat: location.lat, lng: location.lng, formatted, createdAt: new Date() },
  });

  return {
    lat: location.lat,
    lng: location.lng,
    formatted,
    source: 'google',
  };
}

/**
 * Busca endereço por CEP usando ViaCEP (grátis, sem cota).
 * Útil para auto-preencher bairro/cidade quando o cliente digita só o CEP.
 */
export async function lookupZipCode(zipCode: string): Promise<{
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
} | null> {
  const clean = zipCode.replace(/\D/g, '');
  if (clean.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      zipCode: clean,
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch {
    return null;
  }
}
