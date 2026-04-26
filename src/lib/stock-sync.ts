/**
 * Syncs Product.available based on product-level stockCount.
 * Called after any stockCount change (order creation, cancellation, manual adjustment).
 * A product becomes unavailable when stockCount reaches 0.
 * A product is re-enabled when stockCount goes back above 0 (or becomes null = unlimited).
 */
export async function syncProductAvailability(client: any, productIds: string[]) {
  if (!productIds.length) return;
  const products = await client.product.findMany({
    where: { id: { in: productIds }, active: true },
    select: { id: true, available: true, stockCount: true },
  });
  for (const product of products) {
    if (product.stockCount === null || product.stockCount === undefined) continue;
    const shouldBeAvailable = product.stockCount > 0;
    if (shouldBeAvailable !== product.available) {
      await client.product.update({ where: { id: product.id }, data: { available: shouldBeAvailable } });
    }
  }
}
