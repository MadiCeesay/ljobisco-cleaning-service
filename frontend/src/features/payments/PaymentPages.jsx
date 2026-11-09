import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreditCard, ArrowRight, PackageCheck } from 'lucide-react';
import { useAuth } from '../customer/authStore';
import { CustomerField } from '../customer/AccountPages';
import { useCustomerData } from '../customer/customerData';
import { useWorkspace } from '../quotations/useWorkspace';
import { WorkspaceState, quoteDate } from '../quotations/QuotationPages';
import { canSelectPayment } from '../quotations/rules';
import { useCart } from '../../store/cart';
import { formatPrice } from '../../services/catalog';
import { checkoutSchema, paymentPreview, payableAmount, paymentStates } from './rules';
import { depositPercentage, getPaymentAccount, payCleaning, placeOrder, payOrder, localMockPayments } from './services';
import './payments.css';
import { apiConfigured } from '../../services/apiClient';
import { ApiCheckoutPage } from './ApiCheckoutPage';

export function PaymentStatus({ status }) { const label = paymentStates.includes(status) ? status : 'Unavailable'; return <span className={`commerce-status payment-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</span>; }
function SimulationNotice() { return <div className="notice demo-notice"><p><strong>Simulated development transactions only.</strong> No money is transferred. Use sample customer information. Local demo records reset with the preview; explicitly enabled backend simulations are saved in the development database.</p></div>; }
function Gateway({ enabled, outcome, setOutcome, allowOutcome = true }) {
  return <><fieldset className="commerce-options"><legend>Payment method</legend><label><input type="radio" checked={enabled} disabled={!enabled} readOnly />Mock gateway — {enabled ? 'development simulation' : 'development only'}</label><label><input type="radio" disabled />Wave — not connected</label><label><input type="radio" disabled />APS — not connected</label></fieldset>{enabled && allowOutcome && <div className="field"><label htmlFor="mock-outcome">Simulated gateway outcome</label><select id="mock-outcome" value={outcome} onChange={event => setOutcome(event.target.value)}><option value="paid">Successful simulated response</option><option value="failed">Failed simulated response</option></select></div>}<p className="form-hint">No card details are collected. Real payment providers are unavailable.</p></>;
}
function useAccount() {
  const { user, demo } = useAuth();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ payments: [], orders: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    getPaymentAccount(demo, user).then(data => { if (active) setState({ ...data, loading: false, error: '' }); }).catch(error => { if (active) setState(previous => ({ ...previous, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [user, demo, revision]);
  return { ...state, demo, user, refresh: () => setRevision(value => value + 1) };
}
function AccountState({ account, children }) {
  if (account.loading) return <p role="status">Loading payments and orders…</p>;
  if (account.error) return <div className="notice" role="alert"><p>{account.error}</p><button className="button button-outline" onClick={account.refresh}>Try Again</button></div>;
  return children;
}
export function CleaningPaymentsPage() {
  const workspace = useWorkspace();
  const account = useAccount();
  const [params] = useSearchParams();
  const paymentRequest = useRef(null);
  const canMock = account.demo || (localMockPayments && account.mockEnabled);
  const [choice, setChoice] = useState('deposit');
  const [outcome, setOutcome] = useState('paid');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const accepted = workspace.quotes.filter(item => canSelectPayment(item, workspace.quotes, workspace.user) && workspace.bookings.find(booking => booking.id === item.bookingId)?.status !== 'Cancelled');
  const quote = accepted.find(item => item.id === params.get('quotation'));
  const booking = workspace.bookings.find(item => item.id === quote?.bookingId);
  const history = account.payments.filter(item => item.quotationId === quote?.id);
  const paid = history.filter(item => item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);
  const summary = quote ? paymentPreview(quote.total, account.cleaningSummaries?.find(item => item.quotationId === quote.id)?.depositPercentage ?? account.depositPercentage ?? depositPercentage, paid) : null;
  const completed = booking?.status === 'Completed';
  const due = summary ? payableAmount(summary, choice, completed) : 0;
  const status = busy ? 'Processing' : paid >= (quote?.total || Infinity) ? 'Paid' : paid > 0 ? 'Partially Paid' : history.at(-1)?.status || 'Pending';
  async function pay() {
    if (busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      const selectedChoice = paid ? 'balance' : choice;
      const key = `${quote.id}:${selectedChoice}:${outcome}`;
      if (paymentRequest.current?.key !== key) paymentRequest.current = { key, id: crypto.randomUUID() };
      const result = await payCleaning({ quotationId: quote.id, expectedVersion: quote.version, choice: selectedChoice, outcome, requestId: paymentRequest.current.id }, account.demo, account.user);
      paymentRequest.current = null;
      setFeedback(result.status === 'Paid' ? 'Mock gateway confirmed a simulated payment. No money moved.' : 'Mock gateway returned a failed simulated payment. No money moved.');
      account.refresh(); useCustomerData.getState().load(account.demo);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <><div className="customer-page-heading"><div><h1>Cleaning Payments</h1><p>Review your accepted quotation and choose how to pay.</p></div><CreditCard aria-hidden="true" /></div><WorkspaceState workspace={workspace}><AccountState account={account}>{canMock && <SimulationNotice />}{quote ? <div className="commerce-grid"><section className="commerce-panel"><h2>Accepted quotation · Version {quote.version}</h2><p>Booking {booking?.reference || quote.bookingId}</p><PaymentStatus status={status} /><dl className="commerce-summary">{[['Accepted quotation total', summary.total], [`Deposit (${summary.percentage}%)`, summary.deposit], [`Remaining after deposit (${100 - summary.percentage}%)`, summary.remaining], ['Total already paid', summary.paid], ['Outstanding balance', summary.outstanding]].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{formatPrice(amount)}</dd></div>)}</dl><p className="form-hint">Calculations are previews. The backend must calculate, validate and confirm all actual amounts. The remaining balance is payable only after backend-confirmed cleaning completion.</p>{paid === 0 && <fieldset className="commerce-options"><legend>Payment option</legend><label><input type="radio" name="payment-option" checked={choice === 'deposit'} onChange={() => setChoice('deposit')} />Pay {summary.percentage}% deposit · {formatPrice(summary.deposit)}</label><label><input type="radio" name="payment-option" checked={choice === 'full'} onChange={() => setChoice('full')} />Pay 100% upfront · {formatPrice(summary.total)}</label></fieldset>}{paid > 0 && summary.outstanding > 0 && !completed && <div className="notice"><p>Balance payment is locked until completion is confirmed by the backend. A customer cannot mark the cleaning completed.</p></div>}<Gateway enabled={canMock && import.meta.env.DEV} outcome={outcome} setOutcome={setOutcome} allowOutcome={canMock && import.meta.env.DEV} /><button className="button button-primary" disabled={busy || account.loading || !canMock || !due} onClick={pay}>{busy ? 'Processing simulated payment…' : `Simulate Payment · ${formatPrice(due)}`}</button><p role="status">{feedback}</p>{error && <p role="alert" className="field-error">{error}</p>}</section><aside className="commerce-panel"><h2>Payment history</h2>{!history.length ? <p>No payments recorded.</p> : <ul className="commerce-history">{history.map(item => <li key={item.id}><div><strong>{formatPrice(item.amount)}</strong><p>{quoteDate(item.createdAt)}{item.simulated ? ' · Simulated' : ''}</p><small>{item.reference || item.id}</small>{item.simulated && item.status === 'Paid' && <details><summary>View simulated receipt</summary><p>SIMULATED — no real money transferred.<br />Reference: {item.reference || item.id}<br />Gateway: {item.providerReference || 'Local demonstration'}<br />Amount: {formatPrice(item.amount)}<br />Status: {item.status}</p></details>}</div><PaymentStatus status={item.status} /></li>)}</ul>}<Link className="text-link" to={`/dashboard/quotations/${quote.id}`}>View quotation<ArrowRight size={16} /></Link></aside></div> : <div className="commerce-panel"><h2>Select an accepted quotation</h2><p>Payment requires formal acceptance of the latest valid quotation.</p>{accepted.map(item => <p key={item.id}><Link className="text-link" to={`/dashboard/payments?quotation=${item.id}`}>{item.bookingId} · {formatPrice(item.total)}</Link></p>)}<Link className="button button-outline" to="/dashboard/quotations">View Quotations</Link></div>}</AccountState></WorkspaceState></>;
}

export function CheckoutPage() { const demo = useAuth(state => state.demo); return apiConfigured && !demo ? <ApiCheckoutPage /> : <DemoCheckoutPage />; }
function DemoCheckoutPage() {
  const { user, demo } = useAuth();
  const items = useCart(state => state.items);
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [acknowledge, setAcknowledge] = useState(false);
  const [outcome, setOutcome] = useState('paid');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ resolver: zodResolver(checkoutSchema), defaultValues: { name: user?.name || '', email: user?.email || '', phone: user?.phone || '', fulfilment: 'delivery', address: '', town: '' } });
  const fulfilment = watch('fulfilment');
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.quantity, 0) / 100;
  const fingerprint = JSON.stringify(items.map(item => [item.product.id, item.quantity]));
  const enabled = import.meta.env.DEV && demo && user?.role === 'CUSTOMER';
  async function submit() {
    if (busy) return;
    if (fingerprint !== review.fingerprint) { setReview(null); setError('Your cart changed. Review the updated order.'); return; }
    setBusy(true); setError('');
    const submitted = items.map(item => ({ id: item.product.id, quantity: item.quantity, expectedRevision: item.product.revision }));
    try {
      const order = await placeOrder({ details: review.details, items: submitted, outcome, acknowledge, requestId: crypto.randomUUID() }, demo, user);
      if (!order?.id || !order.simulated) throw new Error('An order confirmation was not received.');
      if (order.paymentStatus === 'Paid') useCart.getState().completeCheckout(submitted);
      useCustomerData.getState().load(demo);
      navigate(`/dashboard/orders/${order.id}`);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="section commerce-page"><div className="customer-page-heading"><div><span className="eyebrow">YOUR ORDER</span><h1>Checkout</h1><p>A clear review before you continue.</p></div></div>{import.meta.env.DEV && <SimulationNotice />}{!items.length ? <div className="commerce-panel"><h2>Your cart is empty.</h2><Link className="button button-primary" to="/shop">Browse Products</Link></div> : <div className="commerce-grid"><section className="commerce-panel"><div className="notice"><p><strong>Fulfilment configuration pending.</strong> Delivery areas, fees and pickup location have not been supplied. No real delivery or pickup can be arranged. Delivery fees and the final payable total are not yet available.</p></div>{!enabled && <p className="notice">Checkout is unavailable until business configuration and a payment provider are connected.{import.meta.env.DEV && <> For a local-only test, <Link className="text-link" to="/login?redirect=/checkout">sign in to the customer demo</Link>.</>}</p>}{!review ? <form noValidate onSubmit={handleSubmit(details => { setReview({ details, fingerprint }); setError(''); })}><h2>Customer information</h2><div className="commerce-fields"><CustomerField name="name" label="Full name" register={register} errors={errors} autoComplete="name" /><CustomerField name="email" label="Email address" type="email" register={register} errors={errors} autoComplete="email" /><CustomerField name="phone" label="Phone number" type="tel" register={register} errors={errors} autoComplete="tel" /><CustomerField name="fulfilment" label="Fulfilment preference" register={register} errors={errors}><option value="delivery">Delivery — configuration pending</option><option value="pickup">Pickup — location pending</option></CustomerField>{fulfilment === 'delivery' && <><CustomerField name="address" label="Delivery address" register={register} errors={errors} autoComplete="street-address" /><CustomerField name="town" label="Town or area" register={register} errors={errors} autoComplete="address-level2" /></>}</div><button className="button button-primary commerce-actions" type="submit">Review Order<ArrowRight size={17} /></button></form> : <><h2>Review your order</h2><p>{review.details.name}<br />{review.details.email}<br />{review.details.phone}</p><p>{review.details.fulfilment === 'delivery' ? `Delivery requested: ${review.details.address}, ${review.details.town}` : 'Pickup requested — location not configured.'}</p><Gateway enabled={enabled} outcome={outcome} setOutcome={setOutcome} /><label className="commerce-options"><span><input type="checkbox" checked={acknowledge} onChange={event => setAcknowledge(event.target.checked)} /> I understand this is a simulated order, excludes unconfigured delivery charges and will not be fulfilled.</span></label><div className="commerce-actions"><button className="button button-outline" disabled={busy} onClick={() => setReview(null)}>Edit Details</button><button className="button button-primary" disabled={!enabled || !acknowledge || busy} onClick={submit}>{busy ? 'Awaiting mock gateway…' : 'Place Simulated Order'}</button></div></>}{error && <p role="alert" className="field-error">{error}</p>}</section><aside className="commerce-panel"><h2>Order summary</h2>{items.map(({ product, quantity }) => <div className="commerce-item" key={product.id}><div><strong>{product.name}</strong><small>Quantity {quantity} · Demo product</small></div><strong>{formatPrice(product.price * quantity)}</strong></div>)}<dl className="commerce-summary"><div><dt>Products subtotal preview</dt><dd>{formatPrice(subtotal)}</dd></div><div><dt>Delivery fee</dt><dd>Not configured</dd></div><div><dt>Final payable total</dt><dd>Pending configuration</dd></div></dl><p className="form-hint">The mock order uses only the products subtotal. No delivery fee, inventory reservation or real payment is implied.</p><Link className="text-link" to="/cart">Edit Cart</Link></aside></div>}</div>;
}

function OrderPayment({ order, account }) {
  const [outcome, setOutcome] = useState('paid');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const requestId = useRef(null);
  const payments = account.payments.filter(payment => payment.orderId === order.id);
  const allowed = !account.demo && localMockPayments && account.mockEnabled && ['Pending', 'Failed'].includes(order.paymentStatus) && order.status !== 'Cancelled';
  async function pay() {
    if (busy) return;
    setBusy(true); setFeedback('');
    requestId.current ||= crypto.randomUUID();
    try { const payment = await payOrder(order.id, requestId.current, outcome); requestId.current = null; setFeedback(`Simulated payment ${payment.status.toLowerCase()}. No money moved.`); account.refresh(); }
    catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }
  return <section><h3>Order payment history</h3>{payments.map(payment => <details key={payment.id}><summary>{payment.simulated ? 'Simulated' : 'Payment'} · {payment.status} · {formatPrice(payment.amount)}</summary><p>Reference: {payment.reference}<br />{payment.simulated ? 'No real money transferred.' : ''}<br />{quoteDate(payment.createdAt)}</p></details>)}{allowed && <><Gateway enabled outcome={outcome} setOutcome={value => { setOutcome(value); requestId.current = null; }} /><button className="button button-outline" disabled={busy} onClick={pay}>{busy ? 'Processing…' : 'Retry Simulated Order Payment'}</button><p className="form-hint">An unpaid stock reservation expires after 30 minutes. The backend revalidates the order before every attempt.</p></>}<p role="status">{feedback}</p></section>;
}
export function OrdersPage() {
  const account = useAccount();
  const { id } = useParams();
  const order = account.orders.find(item => item.id === id);
  return <><div className="customer-page-heading"><div><h1>{id ? 'Order Details' : 'Your Orders'}</h1><p>Products, payment status and fulfilment updates in one place.</p></div><PackageCheck aria-hidden="true" /></div>{account.demo && <SimulationNotice />}<AccountState account={account}>{id ? order ? <div className="commerce-grid"><article className="commerce-panel"><h2>{order.simulated ? 'Simulated order confirmation' : 'Order confirmation'}</h2><p style={{ overflowWrap: 'anywhere' }}>Reference: {order.reference || order.id}</p><PaymentStatus status={order.paymentStatus} /><p>Order status: <strong>{order.status}</strong></p><p>Fulfilment: {order.fulfilment} {order.simulated ? '— configuration pending; no fulfilment arranged' : ''}</p>{order.items.map(item => <div className="commerce-item" key={item.productId}><div><strong>{item.name}</strong><small>{item.quantity} × {formatPrice(item.unitPrice)}</small></div><strong>{formatPrice(item.total)}</strong></div>)}<dl className="commerce-summary"><div><dt>{order.simulated ? 'Simulated products total' : 'Order total'}</dt><dd>{formatPrice(order.total)}</dd></div></dl><OrderPayment order={order} account={account} /><Link className="text-link" to="/dashboard/orders">All Orders</Link>{order.paymentStatus === 'Failed' && <p><Link className="button button-outline" to="/cart">Return to Cart</Link></p>}</article><aside className="commerce-panel"><h2>Order timeline</h2><ol className="commerce-timeline">{order.timeline.map((event, index) => <li key={index}>{event.title}<time dateTime={event.at}>{quoteDate(event.at)}</time></li>)}</ol></aside></div> : <div className="commerce-panel"><h2>Order not found.</h2><Link to="/dashboard/orders">View Orders</Link></div> : !account.orders.length ? <div className="commerce-panel"><h2>No orders yet.</h2><Link className="button button-primary" to="/shop">Browse Products</Link></div> : <div className="quotation-list">{account.orders.map(item => <Link className="quotation-list-row" key={item.id} to={`/dashboard/orders/${item.id}`}><div style={{ overflowWrap: 'anywhere' }}><strong>{item.simulated ? 'Simulated order' : item.reference || item.id}</strong><span>{quoteDate(item.createdAt)} · {item.fulfilment} · {item.status}</span></div><strong>{formatPrice(item.total)}</strong><PaymentStatus status={item.paymentStatus} /><ArrowRight size={17} /></Link>)}</div>}</AccountState></>;
}
