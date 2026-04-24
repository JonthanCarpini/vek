/**
 * Syncs Product.available based on mandatory ingredient stock levels.
 * Called after any stock change (order creation, cancellation, manual adjustment).
 * A product becomes unavailable when any mandatory ingredient reaches stock <= 0.
 * A product is re-enabled when ALL mandatory ingredients have stock > 0.
 */
export async function syncProductAvailability(client: any, ingredientIds: string[]) {
  if (!ingredientIds.length) return;

  const pis = await client.productIngredient.findMany({
    where: { ingredientId: { in: ingredientIds }, optional: false },
    select: { productId: true },
  });
  const productIds = [...new Set(pis.map((p: any) => p.productId))] as string[];
  if (!productIds.length) return;

  const products = await client.product.findMany({
    where: { id: { in: productIds }, active: true },
    select: {
      id: true,
      available: true,
      ingredients: {
        where: { optional: false },
        include: { ingredient: { select: { stock: true } } },
      },
    },
  });

  for (const product of products) {
    const canMake = product.ingredients.every((pi: any) => Number(pi.ingredient.stock) > 0);
    if (canMake !== product.available) {
      await client.product.update({ where: { id: product.id }, data: { available: canMake } });
    }
  }
}
