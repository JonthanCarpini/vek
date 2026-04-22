// Cliente HTTP para iFood Merchant API
// Gerencia OAuth2 (client_credentials) com cache de token em banco
// e expõe um fetch wrapper com retry automático em 401.

import { prisma } from '@/lib/prisma';
import type { IfoodAuthResponse } from './types';

const IFOOD_API_URL = process.env.IFOOD_API_URL || 'https://merchant-api.ifood.com.br';
const CLIENT_ID = process.env.IFOOD_CLIENT_ID || '';
const CLIENT_SECRET = process.env.IFOOD_CLIENT_SECRET || '';

const TOKEN_PATH = '/authentication/v1.0/oauth/token';

export class IfoodConfigError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'IfoodConfigError';
  }
}

export class IfoodApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    public endpoint: string,
  ) {
    super(`iFood API ${status} em ${endpoint}: ${JSON.stringify(body)}`);
    this.name = 'IfoodApiError';
  }
}

/**
 * Verifica se as credenciais globais estão configuradas.
 */
export function isIfoodConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

/**
 * Busca o access_token atual do banco ou solicita um novo.
 * Tokens são compartilhados globalmente (unitId=null) pois as credenciais são globais.
 */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!isIfoodConfigured()) {
    throw new IfoodConfigError(
      'Credenciais iFood não configuradas. Defina IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET.'
    );
  }

  if (!forceRefresh) {
    const cached = await (prisma as any).ifoodToken.findUnique({
      where: { unitId: null as any },
    });
    if (cached && cached.expiresAt > new Date()) {
      return cached.accessToken;
    }
  }

  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });

  const res = await fetch(`${IFOOD_API_URL}${TOKEN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new IfoodApiError(res.status, errBody, TOKEN_PATH);
  }

  const data = (await res.json()) as IfoodAuthResponse;
  const expiresAt = new Date(Date.now() + (data.expiresIn - 60) * 1000); // 60s de folga

  await (prisma as any).ifoodToken.upsert({
    where: { unitId: null as any },
    create: { unitId: null, accessToken: data.accessToken, expiresAt },
    update: { accessToken: data.accessToken, expiresAt },
  });

  return data.accessToken;
}

/**
 * Fetch autenticado genérico. Em 401, refresca o token e tenta uma vez mais.
 */
export async function ifoodFetch<T = any>(
  endpoint: string,
  options: RequestInit & { rawResponse?: boolean } = {},
): Promise<T> {
  const doFetch = async (token: string): Promise<Response> => {
    const { rawResponse, headers, ...rest } = options;
    return fetch(`${IFOOD_API_URL}${endpoint}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(rest.body && !(rest.body instanceof URLSearchParams)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(headers || {}),
      },
    });
  };

  let token = await getAccessToken();
  let res = await doFetch(token);

  if (res.status === 401) {
    token = await getAccessToken(true);
    res = await doFetch(token);
  }

  if (!res.ok) {
    const body = await safeJson(res);
    throw new IfoodApiError(res.status, body, endpoint);
  }

  // Alguns endpoints retornam 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  const text = await res.text();
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}

export const ifoodConfig = {
  apiUrl: IFOOD_API_URL,
  hasCredentials: isIfoodConfigured,
};
