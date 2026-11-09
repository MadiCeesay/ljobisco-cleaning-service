import { BusinessWhatsApp } from '../components/WhatsAppAction';
import { demoAvailable } from '../services/demoMode';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, HeartHandshake, ClipboardCheck, SlidersHorizontal, Search, PackageOpen, Minus, Plus, Trash2, ShoppingBag, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useServices } from '../services/useServices';
import { apiConfigured } from '../services/apiClient';
import ServiceCard from '../components/ServiceCard';
import ProductCard from '../components/ProductCard';
import { getProducts, formatPrice } from '../services/catalog';
import { submitContact } from '../services/contact';
import { useCart } from '../store/cart';
import './public-pages.css';

function PageHeading({ eyebrow, title, children }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children && <p>{children}</p>}</div>;
}

function QuoteLink({ service }) {
  return <Link className="button button-primary" to={service ? `/request-quote?service=${encodeURIComponent(service)}` : '/request-quote'}>Request a Quote<ArrowRight size={17} aria-hidden="true" /></Link>;
}

function DemoNotice() {
  return <div className="notice demo-notice"><AlertCircle size={19} aria-hidden="true" /><p><strong>Development demo inventory.</strong> All products, prices and availability shown are sample data for testing. These are not real Ijobisco offers. No purchases or payments can be completed.</p></div>;
}

function EmptyState({ title, children }) {
  return <div className="empty-state"><PackageOpen size={42} strokeWidth={1.3} aria-hidden="true" /><h2>{title}</h2><p>{children}</p></div>;
}

export function ServicesPage() {
  const services = useServices();
  return <div className="public-page section"><PageHeading eyebrow="OUR SERVICES" title="The right clean for your space.">Explore our proposed cleaning services. Share your requirements and Ijobisco will prepare an individual quotation.</PageHeading><div className="service-grid public-services">{services.map(service => <ServiceCard key={service.slug} service={service} />)}</div><div className="notice"><p>Service scope, availability and pricing are confirmed by Ijobisco after reviewing your request.</p></div></div>;
}

export function ServiceDetailsPage() {
  const services = useServices();
  const { slug } = useParams();
  const service = services.find(item => item.slug === slug);
  if (!service) return <NotFoundPage />;
  return <div className="public-page section"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/services">Services</Link><span aria-hidden="true">/</span><span aria-current="page">{service.name}</span></nav><PageHeading eyebrow="CLEANING SERVICES" title={service.name}>{service.description}</PageHeading><img className="detail-photo" src={service.images?.[0] || `/images/${service.image}.webp`} alt={service.alt} width="1000" height="625" /><div className="detail-grid"><div><h2>A clean shaped around you.</h2><p>{service.overview}</p><h2>What to share with us</h2><ul className="check-list">{service.requirements.map(requirement => <li key={requirement}><Check size={18} aria-hidden="true" /><span>{requirement}</span></li>)}</ul><h2>Before your cleaning</h2><p>{service.information}</p></div><aside className="quote-panel"><span className="eyebrow">LET’S START WITH YOUR NEEDS</span><h2>Tell us about your space.</h2><p>Prices are prepared by an administrator after review. There are no fixed cleaning prices or instant estimates.</p><QuoteLink service={service.name} /><small>Sign in to submit your cleaning request and review your quotation.</small></aside></div></div>;
}

export function AboutPage() {
  return <div className="public-page section"><PageHeading eyebrow="ABOUT IJOBISCO" title="Sparkles Starts Here.">Ijobisco Cleaning Services is a cleaning services business based in The Gambia.</PageHeading><div className="about-page-grid"><img src="/images/home-cleaning.webp" alt="Cleaners caring for a modern living room" width="1000" height="625" /><div><span className="eyebrow">OUR MISSION</span><h2>Start with the space.<br />Listen to the people.</h2><p>Our aim is to help homes and businesses care for their spaces through cleaning tailored to their requirements and a clear conversation about the work involved.</p><p>From understanding a request to discussing a quotation, we want the process to feel straightforward and considered.</p><QuoteLink /></div></div><section className="values-section" aria-labelledby="values-title"><span className="eyebrow">WHAT GUIDES US</span><h2 id="values-title">A thoughtful approach.</h2><div className="values-grid">{[[HeartHandshake, 'Listen first', 'Understand each customer’s priorities and the needs of their space.'], [ClipboardCheck, 'Keep it clear', 'Discuss the cleaning scope and official quotation before work is agreed.'], [SlidersHorizontal, 'Make it personal', 'Shape cleaning requirements around the property and the customer.']].map(([Icon, title, description]) => <article key={title}><Icon size={25} aria-hidden="true" /><h3>{title}</h3><p>{description}</p></article>)}</div></section><section className="about-page-cta"><div><span className="eyebrow">WHY CHOOSE IJOBISCO</span><h2>Your needs guide the conversation.</h2><p>Share your cleaning priorities, discuss your quotation and request dates that suit you. The final scope and availability are confirmed with Ijobisco.</p></div><QuoteLink /></section></div>;
}

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100, 'Use 100 characters or fewer.'),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  phone: z.string().trim().regex(/^[+()\d\s-]{7,25}$/, 'Enter a valid phone number.').refine(value => value.replace(/\D/g, '').length >= 7, 'Enter at least 7 digits.'),
  subject: z.string().trim().min(3, 'Enter a subject of at least 3 characters.').max(150, 'Use 150 characters or fewer.'),
  message: z.string().trim().min(10, 'Enter a message of at least 10 characters.').max(3000, 'Use 3,000 characters or fewer.'),
});

export function ContactPage() {
  const [result, setResult] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(contactSchema), defaultValues: { name: '', email: '', phone: '', subject: '', message: '' } });
  async function onSubmit(values) {
    setResult(null);
    try {
      const response = await submitContact(values);
      setResult({ type: response.accepted ? 'success' : 'unavailable', message: response.message });
    } catch {
      setResult({ type: 'error', message: 'The contact service is unavailable. Your message has not been delivered. Please try again later.' });
    }
  }
  return <div className="public-page section"><PageHeading eyebrow="CONTACT" title="Let’s talk about your space.">Tell us what you have in mind. We’ll keep the conversation clear and focused on your needs.</PageHeading><div className="contact-layout"><form className="contact-form" noValidate onSubmit={handleSubmit(onSubmit, () => setResult(null))}><div className="notice"><p>{apiConfigured ? <>Submission requires configured SMTP and an approved business email. A service acknowledgement is not proof of inbox delivery.</> : <><strong>Local form preview.</strong> Validation works, but messages cannot be sent or saved yet. Please use sample details to try the form.</>}</p></div><div className="form-grid">{[['name', 'Full name', 'text', 'name'], ['email', 'Email address', 'email', 'email'], ['phone', 'Phone number', 'tel', 'tel'], ['subject', 'Subject', 'text', 'off']].map(([field, label, type, autoComplete]) => <div className="field" key={field}><label htmlFor={`contact-${field}`}>{label} <span aria-hidden="true">*</span></label><input id={`contact-${field}`} type={type} autoComplete={autoComplete} {...register(field)} aria-required="true" aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${field}-error` : undefined} />{errors[field] && <span className="field-error" id={`${field}-error`} role="alert">{errors[field].message}</span>}</div>)}</div><div className="field"><label htmlFor="contact-message">Message <span aria-hidden="true">*</span></label><textarea id="contact-message" rows={6} {...register('message')} aria-required="true" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'message-error' : undefined} />{errors.message && <span className="field-error" id="message-error" role="alert">{errors.message.message}</span>}</div><p className="form-hint">All fields are required. {apiConfigured ? 'Submitting sends these details to the configured API.' : 'Your details stay in this form and are not transmitted.'}</p><button className="button button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Checking message…' : 'Submit Message'}<ArrowRight size={17} aria-hidden="true" /></button><div aria-live="polite" aria-atomic="true">{result && <div className={`notice ${result.type === 'error' ? 'error-notice' : ''}`} role={result.type === 'error' ? 'alert' : 'status'}><p>{result.type === 'unavailable' && <strong>Form validated successfully. </strong>}{result.message}</p></div>}</div></form><aside className="contact-aside"><BusinessWhatsApp /><span className="eyebrow">IJOBISCO CLEANING SERVICES</span><h2>Sparkles Starts Here.</h2><p>Based in The Gambia, with cleaning services for homes and businesses.</p><p>Official phone, email and address details will appear here once verified by Ijobisco.</p><Link to="/services" className="text-link">Explore our services<ArrowRight size={17} aria-hidden="true" /></Link></aside></div></div>;
}

function useCatalog(demo) {
  const [state, setState] = useState({ products: [], loading: true, error: false, demo });
  useEffect(() => {
    let active = true;
    useCart.getState().setMode(demo);
    getProducts(demo).then(products => { if (active) setState({ products, loading: false, error: false, demo }); }).catch(() => { if (active) setState({ products: [], loading: false, error: true, demo }); });
    return () => { active = false; };
  }, [demo]);
  return state.demo === demo ? state : { products: [], loading: true, error: false };
}

export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const demo = demoAvailable && params.get('demo') === '1';
  const { products, loading, error } = useCatalog(demo);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('name');
  const categories = ['All', ...new Set(products.map(product => product.category))];
  const filtered = products.filter(product => (category === 'All' || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(search.trim().toLowerCase())).sort((first, second) => sort === 'price-low' ? first.price - second.price : sort === 'price-high' ? second.price - first.price : first.name.localeCompare(second.name));
  function toggleDemo() { setParams(demo ? {} : { demo: '1' }); setSearch(''); setCategory('All'); }
  return <div className="public-page section"><PageHeading eyebrow="THE IJOBISCO SHOP" title="Keep that fresh feeling.">Cleaning products, brought together in one place. Our approved product collection will appear here when it is ready.</PageHeading>{demo && <DemoNotice />}{demoAvailable && <div className="demo-controls"><span>Test the shopping interface with isolated sample products.</span><button className="button button-outline" type="button" onClick={toggleDemo}>{demo ? 'Hide Demo Products' : 'Preview Demo Products'}</button></div>}<div className="shop-toolbar"><div className="field search-field"><label htmlFor="product-search">Search products</label><div><Search size={18} aria-hidden="true" /><input id="product-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the collection" /></div></div><div className="field"><label htmlFor="product-category">Category</label><select id="product-category" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></div><div className="field"><label htmlFor="product-sort">Sort by</label><select id="product-sort" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Name: A–Z</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div></div><p className="result-count" role="status">{loading ? 'Loading products…' : `${filtered.length} ${demo ? 'demo ' : ''}products`}</p>{error ? <EmptyState title="The catalogue is unavailable.">Please try again later.</EmptyState> : !loading && !filtered.length ? <EmptyState title={products.length ? 'No products match your search.' : 'Our product collection is on its way.'}>{products.length ? <button className="text-link" type="button" onClick={() => { setSearch(''); setCategory('All'); }}>Clear search and filters</button> : 'No approved products are available yet. Please check back when the catalogue is ready.'}</EmptyState> : <div className="product-grid">{filtered.map(product => <ProductCard key={product.id} product={product} />)}</div>}</div>;
}

export function ProductDetailsPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const demo = demoAvailable && params.get('demo') === '1';
  const { products, loading, error } = useCatalog(demo);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState(0);
  const [feedback, setFeedback] = useState('');
  const addItem = useCart(state => state.addItem);
  const product = products.find(item => item.slug === slug);
  const hasHydrated = useCart(state => state.hasHydrated);
  const inCart = useCart(state => state.items.find(item => item.product.slug === slug)?.quantity || 0);
  useEffect(() => { setQuantity(1); setSelected(0); setFeedback(''); }, [slug]);
  if (loading) return <div className="section public-page" role="status">Loading product…</div>;
  if (error) return <div className="section public-page"><EmptyState title="Product unavailable">Please return to the shop and try again.</EmptyState></div>;
  if (!product) return <NotFoundPage title="Product not available" description="This product is not in the current catalogue. Demo products are available only in the development demo catalogue." to="/shop" label="Back to Shop" />;
  const remaining = hasHydrated ? product.stock - inCart : 0;
  const selectedQuantity = quantity === '' ? NaN : Math.min(Number(quantity), Math.max(1, remaining));
  const validQuantity = Number.isInteger(selectedQuantity) && selectedQuantity >= 1 && selectedQuantity <= remaining;
  return <div className="public-page section"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to={demo ? "/shop?demo=1" : "/shop"}>{demo ? "Demo Shop" : "Shop"}</Link><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav>{demo && <DemoNotice />}<div className="product-detail-grid"><div className="product-gallery"><img className="gallery-main" src={product.images[selected]} alt={`${product.name}, illustration ${selected + 1}`} width="640" height="480" /><div className="gallery-thumbs">{product.images.map((source, index) => <button key={source} type="button" aria-label={`View product image ${index + 1}`} aria-pressed={index === selected} onClick={() => setSelected(index)}><img src={source} alt="" width="80" height="60" /></button>)}</div></div><div className="product-detail-copy"><span className="eyebrow">{demo ? 'DEMO · ' : ''}{product.category}</span><h1>{product.name}</h1><p>{product.description}</p><strong className="detail-price">{formatPrice(product.price)}</strong><p className={product.stock ? 'stock-available' : 'stock-unavailable'}>{product.stock ? ` ${demo ? 'Demo stock: ' : ''}${product.stock} available` : (demo ? 'Demo: out of stock' : 'Out of stock')}</p><p className="form-hint">Fixed {demo ? 'demo ' : ''}product price. Cleaning-service quotation negotiation does not apply to products.</p><div className="field quantity-field"><label htmlFor="product-quantity">Quantity</label><input id="product-quantity" type="number" min="1" max={Math.max(1, remaining)} step="1" value={quantity === '' ? '' : selectedQuantity} disabled={remaining < 1} onChange={event => setQuantity(event.target.value)} aria-invalid={remaining > 0 && !validQuantity} aria-describedby={remaining > 0 && !validQuantity ? 'quantity-error' : undefined} />{remaining > 0 && !validQuantity && <span id="quantity-error" className="field-error" role="alert">Choose a whole quantity between 1 and {remaining}.</span>}</div><button className="button button-primary" disabled={!validQuantity} onClick={() => { addItem(product, selectedQuantity); setFeedback(`Added to your ${demo ? 'demo ' : ''}cart.`); }}><ShoppingBag size={17} aria-hidden="true" />{!product.stock ? 'Out of Stock' : remaining < 1 ? 'Stock Limit Reached' : 'Add to Cart'}</button><p role="status" className="cart-feedback">{feedback}</p><Link className="text-link" to="/cart">View Cart<ArrowRight size={17} aria-hidden="true" /></Link></div></div></div>;
}

export function CartPage() {
  const { items, hasHydrated, setQuantity, removeItem, demo } = useCart();
  const [feedback, setFeedback] = useState('');
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  if (!hasHydrated) return <div className="public-page section" role="status">Loading your cart…</div>;
  return <div className="public-page section"><PageHeading eyebrow="YOUR SHOPPING BAG" title="A little closer to a fresh space.">Review your items before continuing.</PageHeading><p className="sr-only" role="status">{feedback}</p>{!items.length ? <><EmptyState title="Your cart is empty.">Browse the shop to explore the catalogue.</EmptyState><Link className="button button-primary" to="/shop">Continue Shopping<ArrowRight size={17} aria-hidden="true" /></Link></> : <>{demo && <DemoNotice />}<div className="cart-layout"><div className="cart-items">{items.map(({ product, quantity }) => <article className="cart-item" key={product.id}><img src={product.images[0]} alt={`${product.name} illustration`} width="120" height="90" /><div className="cart-item-content"><h2><Link to={`/shop/${product.slug}${demo ? '?demo=1' : ''}`}>{product.name}</Link></h2><p>{formatPrice(product.price)} each{demo ? ' · Demo item' : ''}</p><div className="quantity-control"><button type="button" disabled={quantity <= 1} aria-label={`Decrease quantity of ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}><Minus size={16} /></button><span aria-label={`Quantity: ${quantity}`}>{quantity}</span><button type="button" disabled={quantity >= product.stock} aria-label={`Increase quantity of ${product.name}`} onClick={() => setQuantity(product.id, quantity + 1)}><Plus size={16} /></button></div></div><div className="cart-item-end"><strong>{formatPrice(product.price * quantity)}</strong><button className="remove-item" type="button" onClick={() => { removeItem(product.id); setFeedback(`${product.name} removed from your cart.`); }} aria-label={`Remove ${product.name}`}><Trash2 size={16} aria-hidden="true" />Remove</button></div></article>)}<Link className="text-link" to={demo ? "/shop?demo=1" : "/shop"}>Continue Shopping<ArrowRight size={17} aria-hidden="true" /></Link></div><aside className="cart-summary"><h2>{demo ? 'Demo order summary' : 'Order summary'}</h2><div aria-live="polite"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><p>Review checkout for server-confirmed configuration and totals. Live payment providers remain unavailable.</p><Link className="button button-primary" to="/checkout">Proceed to Checkout<ArrowRight size={17} aria-hidden="true" /></Link></aside></div></>}</div>;
}

export function NotFoundPage({ title = 'This page needs a fresh start.', description = 'We couldn’t find the page you’re looking for. Explore our services or return to the homepage.', to = '/', label = 'Back to Homepage' }) {
  return <div className="public-page section not-found"><span className="eyebrow">PAGE NOT FOUND · 404</span><h1>{title}</h1><p>{description}</p><Link className="button button-primary" to={to}>{label}<ArrowRight size={17} aria-hidden="true" /></Link></div>;
}
