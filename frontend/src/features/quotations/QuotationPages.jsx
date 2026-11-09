import { BookingWhatsApp } from '../../components/WhatsAppAction';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, FileCheck2, History } from 'lucide-react';
import { useWorkspace } from './useWorkspace';
import { canRespond, canSelectPayment, displayStatus } from './rules';
import { respondQuotation } from './services';
import { useCustomerData } from '../customer/customerData';
import { formatPrice } from '../../services/catalog';
import { serviceName } from '../customer/DashboardPages';
import './quotations.css';

export const quoteDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not specified';
export function QuoteStatus({ quote, now }) { const status = displayStatus(quote, now); return <span className={`quote-status status-${status.toLowerCase()}`}>{status}</span>; }
export function WorkspaceState({ workspace, children }) {
  if (workspace.loading) return <p role="status">Loading quotation information…</p>;
  if (workspace.error) return <div className="notice error-notice" role="alert"><p>{workspace.error}</p><button type="button" className="button button-outline" onClick={workspace.refresh}>Try Again</button></div>;
  return children;
}

export function QuotationsPage() {
  const workspace = useWorkspace();
  const quotes = [...workspace.quotes].sort((first, second) => second.version - first.version);
  return <><div className="customer-page-heading"><div><h1>Your Quotations</h1><p>Official offers prepared by your administrator. Only the latest valid version can be accepted.</p></div></div><WorkspaceState workspace={workspace}>{!quotes.length ? <div className="dashboard-empty"><FileCheck2 size={30} aria-hidden="true" /><h2>No quotations yet.</h2><p>Your administrator will prepare the first official quotation after reviewing your request.</p></div> : <div className="quotation-list">{quotes.map(quote => <Link className="quotation-list-row" key={quote.id} to={`/dashboard/quotations/${quote.id}`}><div><strong>{serviceName(workspace.bookings.find(booking => booking.id === quote.bookingId)?.service)}</strong><span>{quote.bookingId} · Version {quote.version}{quote.version > 1 ? ' · Revised' : ''}</span></div><strong>{formatPrice(quote.total)}</strong><QuoteStatus quote={quote} /><ArrowRight size={17} aria-hidden="true" /></Link>)}</div>}</WorkspaceState></>;
}

export function ConfirmationDialog({ action, quote, busy, error, onCancel, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  return <dialog ref={dialog} className="quote-dialog" aria-labelledby="confirmation-title" aria-describedby="confirmation-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}><h2 id="confirmation-title">{action === 'accept' ? 'Accept' : 'Decline'} quotation version {quote.version}?</h2><p id="confirmation-description">{action === 'accept' ? `You are formally accepting the official quotation of ${formatPrice(quote.total)}. Payment selection becomes available only after the service confirms acceptance.` : 'You are declining this official quotation. You can discuss your requirements with the administrator.'}</p>{error && <p role="alert" className="field-error">{error}</p>}<div className="dialog-actions"><button autoFocus type="button" disabled={busy} className="button button-outline" onClick={onCancel}>Cancel</button><button type="button" disabled={busy} className="button button-primary" onClick={onConfirm}>{busy ? 'Confirming…' : action === 'accept' ? 'Confirm Acceptance' : 'Confirm Decline'}</button></div></dialog>;
}

export function QuotationDetailsPage() {
  const { id } = useParams();
  const workspace = useWorkspace();
  const [now, setNow] = useState(Date.now());
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { setAction(null); setError(''); setFeedback(''); }, [id]);
  const quote = workspace.quotes.find(item => item.id === id);
  const booking = workspace.bookings.find(item => item.id === quote?.bookingId);
  const admin = workspace.user.role === 'ADMIN';
  const prefix = admin ? '/admin' : '/dashboard';
  const history = workspace.quotes.filter(item => item.bookingId === quote?.bookingId).sort((first, second) => second.version - first.version);
  const allowed = booking?.status !== 'Cancelled' && canRespond(quote, workspace.quotes, workspace.user, now);
  async function confirm() {
    setBusy(true); setError('');
    try { await respondQuotation(quote, action, workspace.demo, workspace.user); setFeedback(action === 'accept' ? 'The service confirmed formal quotation acceptance.' : 'The service confirmed quotation decline.'); setAction(null); workspace.refresh(); useCustomerData.getState().load(workspace.demo); }
    catch (error) { setError(error.message); workspace.refresh(); }
    finally { setBusy(false); }
  }
  return <><Link className="text-link" to={`${prefix}/quotations`}>Back to Quotations</Link><WorkspaceState workspace={workspace}>{quote && booking ? <><div className="customer-page-heading"><div><span className="eyebrow">OFFICIAL QUOTATION · VERSION {quote.version}</span><h1>{serviceName(booking.service)}</h1><p>Booking {booking.reference || quote.bookingId} · {booking.propertyType} · {booking.rooms} rooms / areas</p></div><QuoteStatus quote={quote} now={now} /></div><div className="quote-details-grid"><article className="booking-detail-card"><dl className="review-grid"><div><dt>Property</dt><dd>{booking.address}, {booking.town}</dd></div><div><dt>Approximate size</dt><dd>{booking.size ? `${booking.size} m²` : 'Not specified'}</dd></div><div><dt>Issued</dt><dd>{quoteDate(quote.issuedAt)}</dd></div><div><dt>Expires</dt><dd>{quoteDate(quote.expiresAt)}</dd></div></dl><div className="quote-table-scroll"><table className="quote-table"><caption>Itemized charges in GMD</caption><thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead><tbody>{quote.items.map((item, index) => <tr key={index}><td>{item.description}</td><td>{item.quantity}</td><td>{formatPrice(Number(item.unitPrice))}</td><td>{formatPrice(item.total)}</td></tr>)}</tbody></table></div><div className="quotation-total"><span>Quotation total · GMD</span><strong>{formatPrice(quote.total)}</strong></div>{quote.notes && <div className="notice"><p>{quote.notes}</p></div>}<p className="form-hint">Amounts and status above are supplied by the quotation service{workspace.demo ? ' demo adapter' : ''}. Chat messages never count as formal acceptance.</p><div className="quotation-actions">{allowed && <><button type="button" className="button button-primary" onClick={() => { setAction('accept'); setError(''); }}>Accept Quotation</button><button type="button" className="button button-outline" onClick={() => { setAction('decline'); setError(''); }}>Decline Quotation</button></>}<BookingWhatsApp booking={booking} quotationVersion={quote.version} /></div>{!admin && !allowed && !canSelectPayment(quote, workspace.quotes, workspace.user) && <p className="form-hint">This version cannot be accepted or declined. Review the latest valid quotation or contact the administrator.</p>}{canSelectPayment(quote, workspace.quotes, workspace.user) && <Link className="button button-primary payment-selection-link" to={`/dashboard/payments?quotation=${quote.id}`}>Continue to Payment Selection<ArrowRight size={17} aria-hidden="true" /></Link>}<p role="status" className="cart-feedback">{feedback}</p></article><aside className="quote-history"><h2><History size={20} aria-hidden="true" />Revision history</h2>{history.map(version => <Link key={version.id} className={version.id === id ? 'history-item current' : 'history-item'} to={`${prefix}/quotations/${version.id}`} aria-current={version.id === id ? 'page' : undefined}><strong>Version {version.version}{version.version > 1 ? ' · Revised' : ''}</strong><QuoteStatus quote={version} now={now} /><span>{quoteDate(version.issuedAt)}</span><span>{formatPrice(version.total)}</span></Link>)}</aside></div>{action && <ConfirmationDialog action={action} quote={quote} busy={busy} error={error} onCancel={() => setAction(null)} onConfirm={confirm} />}</> : <div className="dashboard-empty"><h1>Quotation not found.</h1><p>This quotation is unavailable in your account.</p></div>}</WorkspaceState></>;
}

