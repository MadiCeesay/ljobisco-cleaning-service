import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { formatPrice } from '../services/catalog';
import { useCart } from '../store/cart';

export default function ProductCard({ product }) {
  const addItem = useCart(state => state.addItem);
  const hasHydrated = useCart(state => state.hasHydrated);
  const quantity = useCart(state => state.items.find(item => item.product.id === product.id)?.quantity || 0);
  const [feedback, setFeedback] = useState('');
  const limitReached = quantity >= product.stock;
  return <article className="product-card">
    <Link className="product-picture" to={`/shop/${product.slug}${product.demo ? '?demo=1' : ''}`} tabIndex={-1} aria-hidden="true"><img src={product.images[0]} alt="" width="640" height="480" loading="lazy" /></Link>
    <div className="product-body"><span className="eyebrow">{product.demo ? 'DEMO · ' : ''}{product.category}</span><h2><Link to={`/shop/${product.slug}${product.demo ? '?demo=1' : ''}`}>{product.name}</Link></h2><div className="price-line"><strong>{formatPrice(product.price)}</strong><span className={product.stock ? 'stock-available' : 'stock-unavailable'}>{product.stock ? (product.demo ? 'Demo: in stock' : 'In stock') : (product.demo ? 'Demo: out of stock' : 'Out of stock')}</span></div>
      <button type="button" className="button button-primary" disabled={!hasHydrated || !product.stock || limitReached} onClick={() => { addItem(product); setFeedback(`${product.name} added to your ${product.demo ? 'demo ' : ''}cart.`); }}><ShoppingBag size={16} aria-hidden="true" />{!product.stock ? 'Out of Stock' : limitReached ? 'Stock Limit Reached' : 'Add to Cart'}</button><span className="card-feedback" role="status">{feedback}</span>
    </div>
  </article>;
}
