const MAX_ITEMS = 100;

function validReference(item) {
  return item && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128 && Number.isSafeInteger(item.quantity) && item.quantity > 0;
}

export function readCart(storage, key) {
  try {
    const stored = JSON.parse(storage?.getItem(key) || 'null');
    if (stored?.version !== 1 || !Array.isArray(stored.items)) return [];
    const seen = new Set();
    return stored.items.slice(0, MAX_ITEMS).filter(item => {
      if (!validReference(item) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).map(({ id, quantity }) => ({ id, quantity }));
  } catch {
    return [];
  }
}

export function writeCart(storage, key, items) {
  try {
    const references = items.map(item => ({ id: item.product.id, quantity: item.quantity })).filter(validReference).slice(0, MAX_ITEMS);
    storage?.setItem(key, JSON.stringify({ version: 1, items: references }));
  } catch {
    return false;
  }
  return true;
}

export function resolveCart(references, products) {
  const catalog = new Map(products.map(product => [product.id, product]));
  return references.flatMap(reference => {
    const product = catalog.get(reference.id);
    if (!validReference(reference) || !product || !Number.isSafeInteger(product.stock) || product.stock <= 0) return [];
    return [{ product, quantity: Math.min(reference.quantity, product.stock) }];
  });
}
