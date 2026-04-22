// Sincronização de catálogo (push manual) para o iFood.
// Fluxo simplificado:
//  1. Listar catálogos do merchant e escolher o primeiro ativo
//  2. Garantir categoria no iFood correspondente à categoria local
//  3. Criar/atualizar o item no catálogo
//  4. Persistir ifoodItemId no Product local
//
// Referência: https://developer.ifood.com.br/pt-BR/docs/references/catalog

import { prisma } from '@/lib/prisma';
import { ifoodFetch } from './client';

const CATALOG_PATH = '/catalog/v2.0/merchants';

async function getMerchantId(unitId: string): Promise<string> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } }) as any;
  if (!unit?.ifoodMerchantId) throw new Error('Unidade sem merchantId iFood configurado');
  if (!unit.ifoodEnabled) throw new Error('Integração iFood desativada para esta unidade');
  return unit.ifoodMerchantId;
}

interface IfoodCatalogSummary { catalogId: string; context: string; status: string; }

async function getActiveCatalog(merchantId: string): Promise<IfoodCatalogSummary> {
  const catalogs = await ifoodFetch<IfoodCatalogSummary[]>(`${CATALOG_PATH}/${merchantId}/catalogs`);
  const active = Array.isArray(catalogs) ? catalogs.find((c) => c.status === 'AVAILABLE') : null;
  if (!active) throw new Error('Nenhum catálogo ativo encontrado no iFood');
  return active;
}

/**
 * Publica/atualiza um produto local no catálogo iFood.
 * - Se o produto já tem ifoodItemId -> PATCH (atualiza preço/disponibilidade/nome).
 * - Caso contrário, POST criando novo item.
 */
export async function publishProductToIfood(productId: string): Promise<{ ifoodItemId: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  }) as any;
  if (!product) throw new Error('Produto não encontrado');
  if (!product.active) throw new Error('Produto inativo não pode ser publicado');

  const merchantId = await getMerchantId(product.unitId);
  const catalog = await getActiveCatalog(merchantId);

  const itemPayload = {
    item: {
      type: 'PRODUCT',
      status: product.available ? 'AVAILABLE' : 'UNAVAILABLE',
      externalCode: product.id,
      price: {
        value: Number(product.price),
        originalValue: Number(product.price),
      },
      product: {
        name: product.name,
        description: product.description || product.name,
        externalCode: product.id,
        image: product.imageUrl || undefined,
      },
      shifts: [], // herda hor\u00e1rios do cat\u00e1logo
    },
    categoryName: product.category?.name || 'Geral',
  };

  let response: any;
  if (product.ifoodItemId) {
    // Atualiza existente
    response = await ifoodFetch(
      `${CATALOG_PATH}/${merchantId}/catalogs/${catalog.catalogId}/items/${product.ifoodItemId}`,
      { method: 'PATCH', body: JSON.stringify(itemPayload) },
    );
  } else {
    // Cria novo
    response = await ifoodFetch(
      `${CATALOG_PATH}/${merchantId}/catalogs/${catalog.catalogId}/items`,
      { method: 'POST', body: JSON.stringify(itemPayload) },
    );
  }

  const ifoodItemId: string = response?.item?.id || response?.id || product.ifoodItemId;
  if (!ifoodItemId) throw new Error('iFood não retornou id do item publicado');

  await (prisma.product as any).update({
    where: { id: product.id },
    data: {
      ifoodItemId,
      ifoodPublished: true,
      ifoodLastSyncAt: new Date(),
    },
  });

  return { ifoodItemId };
}

/**
 * Altera apenas a disponibilidade do item no iFood (mais leve que um update completo).
 * Útil quando o estoque de um ingrediente acaba.
 */
export async function setIfoodItemAvailability(productId: string, available: boolean) {
  const product = await prisma.product.findUnique({ where: { id: productId } }) as any;
  if (!product) throw new Error('Produto não encontrado');
  if (!product.ifoodItemId) return; // ainda não publicado

  const merchantId = await getMerchantId(product.unitId);
  const catalog = await getActiveCatalog(merchantId);

  await ifoodFetch(
    `${CATALOG_PATH}/${merchantId}/catalogs/${catalog.catalogId}/items/${product.ifoodItemId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: available ? 'AVAILABLE' : 'UNAVAILABLE' }),
    },
  );

  await (prisma.product as any).update({
    where: { id: product.id },
    data: { ifoodLastSyncAt: new Date() },
  });
}

/**
 * Remove um item do catálogo iFood.
 */
export async function unpublishProductFromIfood(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } }) as any;
  if (!product?.ifoodItemId) return;

  const merchantId = await getMerchantId(product.unitId);
  const catalog = await getActiveCatalog(merchantId);

  await ifoodFetch(
    `${CATALOG_PATH}/${merchantId}/catalogs/${catalog.catalogId}/items/${product.ifoodItemId}`,
    { method: 'DELETE' },
  );

  await (prisma.product as any).update({
    where: { id: product.id },
    data: { ifoodItemId: null, ifoodPublished: false, ifoodLastSyncAt: new Date() },
  });
}
