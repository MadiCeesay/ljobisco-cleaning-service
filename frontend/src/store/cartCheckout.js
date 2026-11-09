export function consumeSubmittedCart(items, submitted) {
  const quantities = new Map(submitted.map(item => [item.id, item.quantity]));
  return items.map(item => ({ ...item, quantity: Math.max(0, item.quantity - (quantities.get(item.product.id) || 0)) })).filter(item => item.quantity > 0);
}
