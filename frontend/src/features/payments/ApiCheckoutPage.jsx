import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCart } from '../../store/cart';
import { formatPrice } from '../../services/catalog';
import { useAuth } from '../customer/authStore';
import { CustomerField } from '../customer/AccountPages';
import { checkoutSchema } from './rules';
import { getCheckoutConfiguration, previewOrder, placeOrder, localMockPayments } from './services';

export function ApiCheckoutPage() {
  const { user } = useAuth();
  const { items, demo: demoCart, completeCheckout } = useCart();
  const [configuration, setConfiguration] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState('paid');
  const [acknowledge, setAcknowledge] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ resolver: zodResolver(checkoutSchema), defaultValues: { name: user?.name || '', email: user?.email || '', phone: user?.phone || '', fulfilment: 'delivery', address: '', town: '' } });
  const fingerprint = JSON.stringify(items.map(item => [item.product.id, item.quantity, item.product.revision]));
  const fulfilment = watch('fulfilment');
  const simulated = localMockPayments && configuration?.mockEnabled;
  useEffect(() => { let active = true; getCheckoutConfiguration().then(value => { if (active) setConfiguration(value); }).catch(error => { if (active) setError(error.message); }); return () => { active = false; }; }, []);
  async function reviewOrder(details) {
    setBusy(true); setError('');
    try {
      const submitted = items.map(item => ({ id: item.product.id, quantity: item.quantity, expectedRevision: item.product.revision }));
      const payload = { requestId: requestId.current, details, items: submitted };
      const amounts = await previewOrder(payload); setReview({ payload, amounts, fingerprint });
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (busy || review.fingerprint !== fingerprint) { setError('Your cart changed. Review it again.'); return; }
    setBusy(true); setError('');
    try {
      const order = await placeOrder({ ...review.payload, outcome }, false, user);
      if (!order?.id) throw new Error('Order confirmation was not received. Check Your Orders before retrying.');
      completeCheckout(review.payload.items); navigate(`/dashboard/orders/${order.id}`);
    } catch (error) { setError(`${error.message} Check Your Orders before retrying if an order may have been created.`); }
    finally { setBusy(false); }
  }
  const configured = fulfilment === 'delivery' ? configuration?.deliveryEnabled : configuration?.pickupEnabled;
  return <div className="section commerce-page"><div className="customer-page-heading"><div><span className="eyebrow">YOUR ORDER</span><h1>Checkout</h1><p>A clear review before you continue.</p></div></div>{!items.length ? <div className="commerce-panel"><h2>Your cart is empty.</h2><Link className="button button-primary" to="/shop">Browse Products</Link></div> : <div className="commerce-grid"><section className="commerce-panel">{simulated ? <div className="notice"><p><strong>Development mock gateway.</strong> No money is transferred. Simulated records are saved in the development database.</p></div> : <div className="notice"><p>Wave and APS are not operational. You may create an unpaid order when fulfilment is configured. No payment is taken; unpaid stock reservations expire after 30 minutes.</p></div>}{!configuration ? <p role="status">Loading fulfilment configuration…</p> : !configured && <p className="notice">The selected fulfilment method requires administrator configuration before ordering.</p>}{!user || user.role !== 'CUSTOMER' ? <p><Link className="button button-primary" to="/login?redirect=/checkout">Sign in to continue</Link></p> : demoCart ? <p className="notice">This cart contains isolated demo inventory. Open the live shop before using the connected checkout.</p> : !review ? <form noValidate onSubmit={handleSubmit(reviewOrder)}><h2>Customer information</h2><div className="commerce-fields"><CustomerField name="name" label="Full name" register={register} errors={errors} /><CustomerField name="email" label="Email address" type="email" register={register} errors={errors} /><CustomerField name="phone" label="Phone number" type="tel" register={register} errors={errors} /><CustomerField name="fulfilment" label="Fulfilment method" register={register} errors={errors}><option value="delivery">Delivery</option><option value="pickup">Pickup</option></CustomerField>{fulfilment === 'delivery' ? <><CustomerField name="address" label="Delivery address" register={register} errors={errors} /><CustomerField name="town" label="Town or area" register={register} errors={errors} /></> : configuration?.pickupEnabled && <p>Pickup: {configuration.pickupLocation}<br />{configuration.pickupInstructions}</p>}</div><button className="button button-primary commerce-actions" disabled={busy || !configured} type="submit">{busy ? 'Checking order…' : 'Review Order'}</button></form> : <><h2>Review your order</h2><p>{review.payload.details.name}<br />{review.payload.details.email}<br />{review.payload.details.phone}</p><p>{review.payload.details.fulfilment === 'delivery' ? `${review.payload.details.address}, ${review.payload.details.town}` : configuration.pickupLocation}</p><fieldset className="commerce-options"><legend>Payment method</legend><label><input type="radio" checked={simulated} disabled={!simulated} readOnly />{simulated ? 'Mock gateway — simulated development payment' : 'Payment provider pending configuration'}</label><label><input type="radio" disabled />Wave — unavailable</label><label><input type="radio" disabled />APS — unavailable</label></fieldset><>{simulated && <div className="field"><label htmlFor="checkout-mock-outcome">Simulated gateway outcome</label><select id="checkout-mock-outcome" disabled={busy} value={outcome} onChange={event => setOutcome(event.target.value)}><option value="paid">Successful simulated response</option><option value="failed">Failed simulated response</option></select></div>}</><label className="commerce-options"><span><input type="checkbox" checked={acknowledge} onChange={event => setAcknowledge(event.target.checked)} />{simulated ? 'I understand no real money is transferred.' : 'I understand this creates an unpaid order, not a successful payment.'}</span></label><div className="commerce-actions"><button className="button button-outline" onClick={() => { setReview(null); requestId.current = crypto.randomUUID(); }}>Edit Details</button><button className="button button-primary" disabled={busy || !acknowledge} onClick={submit}>{busy ? 'Confirming order…' : simulated ? 'Place Simulated Order' : 'Create Unpaid Order'}</button></div></>}{error && <p role="alert" className="field-error">{error}</p>}</section><aside className="commerce-panel"><h2>Order summary</h2>{items.map(({ product, quantity }) => <div className="commerce-item" key={product.id}><div><strong>{product.name}</strong><small>Quantity {quantity}</small></div><strong>{formatPrice(product.price * quantity)}</strong></div>)}<dl className="commerce-summary"><div><dt>Subtotal preview</dt><dd>{formatPrice(items.reduce((total, item) => total + item.product.price * item.quantity, 0))}</dd></div><div><dt>Delivery fee</dt><dd>{review ? formatPrice(review.amounts.deliveryFee) : 'Confirmed during review'}</dd></div><div><dt>Server-calculated total</dt><dd>{review ? formatPrice(review.amounts.total) : 'Review required'}</dd></div></dl><Link className="text-link" to="/cart">Edit Cart</Link></aside></div>}</div>;
}
