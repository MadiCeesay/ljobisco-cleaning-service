import test from 'node:test';
import assert from 'node:assert/strict';
import { readCart, writeCart, resolveCart } from './cartPersistence.js';

const product = { id: 'demo-spray', price: 120, stock: 8, name: 'Current catalogue name' };
const key = 'test-cart';
const storageWith = value => ({ getItem: () => value });

test('only identifiers and quantities are written', () => {
  let saved;
  writeCart({ setItem: (savedKey, value) => { assert.equal(savedKey, key); saved = JSON.parse(value); } }, key, [{ product, quantity: 2 }]);
  assert.deepEqual(saved, { version: 1, items: [{ id: 'demo-spray', quantity: 2 }] });
});

test('stored prices, stock and sensitive fields are discarded', () => {
  const references = readCart(storageWith(JSON.stringify({ version: 1, items: [{ id: product.id, quantity: 99, price: 1, stock: 999, email: 'discard@example.com' }] })), key);
  assert.deepEqual(references, [{ id: product.id, quantity: 99 }]);
  assert.deepEqual(resolveCart(references, [product]), [{ product, quantity: 8 }]);
});

test('missing, malformed and unsupported storage safely become empty carts', () => {
  for (const value of [null, '', '{invalid', 'null', '[]', '{"version":2,"items":[]}', '{"version":1,"items":{}}']) assert.deepEqual(readCart(storageWith(value), key), []);
});

test('invalid, duplicate and excessive references are filtered', () => {
  const items = [{ id: product.id, quantity: 2 }, { id: product.id, quantity: 3 }, { id: 'negative', quantity: -1 }, { id: 'decimal', quantity: 1.5 }, { id: 'string', quantity: '2' }, null, { id: '', quantity: 1 }];
  assert.deepEqual(readCart(storageWith(JSON.stringify({ version: 1, items })), key), [{ id: product.id, quantity: 2 }]);
  const many = Array.from({ length: 200 }, (_, index) => ({ id: `id-${index}`, quantity: 1 }));
  assert.equal(readCart(storageWith(JSON.stringify({ version: 1, items: many })), key).length, 100);
});

test('removed or unavailable products are not restored', () => {
  assert.deepEqual(resolveCart([{ id: 'removed', quantity: 1 }, { id: product.id, quantity: 2 }], [{ ...product, stock: 0 }]), []);
  assert.deepEqual(resolveCart([{ id: product.id, quantity: 2 }], []), []);
});

test('storage denial and quota errors do not break the cart', () => {
  const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
  assert.deepEqual(readCart(blocked, key), []);
  assert.equal(writeCart(blocked, key, [{ product, quantity: 2 }]), false);
  assert.deepEqual(readCart(undefined, key), []);
});
