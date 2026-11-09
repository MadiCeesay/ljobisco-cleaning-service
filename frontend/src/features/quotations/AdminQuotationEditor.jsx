import { demoAvailable } from '../../services/demoMode';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '../customer/authStore';
import { CustomerField } from '../customer/AccountPages';
import { authSchema } from '../customer/validation';
import { useWorkspace } from './useWorkspace';
import { latestQuote, previewAmounts, quotationEditorSchema, displayStatus } from './rules';
import { issueQuotation } from './services';
import { QuoteStatus, WorkspaceState } from './QuotationPages';
import { formatPrice } from '../../services/catalog';
import { serviceName } from '../customer/DashboardPages';

export function ProtectedAdministrator() {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <p className="section" role="status">Checking your session…</p>;
  if (!user) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  if (user.role !== 'ADMIN') return <section className="section"><h1>Administrator access required.</h1><p>Your customer account cannot access administrator operations.</p><Link className="text-link" to="/dashboard">Back to your dashboard</Link></section>;
  return <Outlet />;
}

export function AdministratorAccess() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(authSchema('login')), defaultValues: { email: '', password: '' } });
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  async function enter(values, demo) { setError(''); try { await login(values, demo, 'ADMIN'); navigate('/admin', { replace: true }); } catch (error) { setError(error.message); } }
  return <section className="section account-page"><div className="account-intro"><span className="eyebrow">ADMINISTRATOR ACCESS</span><h1>Administrator workspace.</h1><p>Only administrator sessions can issue official quotations. There is no public administrator registration.</p></div><div className="account-panel"><form noValidate onSubmit={handleSubmit(values => enter(values, false))}><fieldset className="customer-fieldset" disabled={isSubmitting || demoBusy}><CustomerField name="email" label="Administrator email" type="email" autoComplete="username" register={register} errors={errors} /><CustomerField name="password" label="Administrator password" type="password" autoComplete="current-password" register={register} errors={errors} /><button type="submit" className="button button-primary">{isSubmitting ? 'Checking…' : 'Administrator Log In'}</button></fieldset></form>{demoAvailable && <div className="notice"><p><strong>Development-only administrator preview.</strong> This separate tool changes the local demo role. It does not create an administrator account or provide production authorization.</p><button type="button" className="button button-outline" disabled={demoBusy || isSubmitting} onClick={async () => { setDemoBusy(true); try { await enter({}, true); } finally { setDemoBusy(false); } }}>{demoBusy ? 'Opening…' : 'Open Administrator Demo'}</button></div>}{error && <p role="alert" className="field-error">{error}</p>}</div></section>;
}

const initialValues = { bookingId: '', items: [{ description: '', quantity: '1', unitPrice: '' }], notes: '', expiresAt: '' };
export function AdminQuotationForm({ bookings, quotes, onIssue, initialBookingId = '' }) {
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const { control, register, handleSubmit, watch, reset, formState: { errors } } = useForm({ resolver: zodResolver(quotationEditorSchema), defaultValues: { ...initialValues, bookingId: initialBookingId } });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const values = watch();
  const amounts = previewAmounts(values.items);
  const selected = latestQuote(quotes, values.bookingId);
  async function issue() {
    setBusy(true); setError('');
    try { const quote = await onIssue(review.values, review.expectedVersion); setFeedback(`The demo/service returned official version ${quote.version}.`); setReview(null); reset({ ...initialValues, bookingId: quote.bookingId }); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="admin-editor-card"><h2>{selected ? `Prepare revision ${selected.version + 1}` : 'Prepare an official quotation'}</h2><p className="form-hint">Only eligible bookings are listed. Totals below are a frontend preview, not an authoritative calculation.</p>{review ? <div><h3>Review before sending</h3><p>Booking {review.values.bookingId} · New version {review.expectedVersion + 1}</p><ul className="editor-review-lines">{review.values.items.map((item, index) => <li key={index}>{item.description} · {item.quantity} × {formatPrice(Number(item.unitPrice))}</li>)}</ul><p>Preview total: <strong>{formatPrice(previewAmounts(review.values.items).total)}</strong></p><p>Expiry: {new Date(review.values.expiresAt).toLocaleString('en-GB')}</p><p className="quote-note">{review.values.notes}</p><div className="dialog-actions"><button key="edit" className="button button-outline" type="button" disabled={busy} onClick={() => { setReview(null); setError(''); }}>Edit Quotation</button><button key="send" className="button button-primary" type="button" disabled={busy} onClick={issue}>{busy ? 'Issuing…' : 'Send Official Quotation'}</button></div></div> : <form noValidate onSubmit={handleSubmit(data => { setReview({ values: data, expectedVersion: latestQuote(quotes, data.bookingId)?.version || 0 }); setError(''); })}><fieldset className="customer-fieldset" disabled={busy}><CustomerField name="bookingId" label="Eligible booking" register={register} errors={errors}><option value="">Select a booking</option>{bookings.map(booking => <option key={booking.id} value={booking.id}>{booking.id} · {serviceName(booking.service)}</option>)}</CustomerField><div className="editor-items">{fields.map((field, index) => <div className="editor-line" key={field.id}>{[['description', 'Description', 'text'], ['quantity', 'Quantity', 'number'], ['unitPrice', 'Unit price (GMD)', 'number']].map(([name, label, type]) => <div className="field" key={name}><label htmlFor={`item-${index}-${name}`}>{label} for item {index + 1}</label><input id={`item-${index}-${name}`} type={type} step={type === 'number' ? '.01' : undefined} min={type === 'number' ? '0' : undefined} {...register(`items.${index}.${name}`)} aria-invalid={Boolean(errors.items?.[index]?.[name])} aria-describedby={errors.items?.[index]?.[name] ? `item-${index}-${name}-error` : undefined} />{errors.items?.[index]?.[name] && <span className="field-error" role="alert" id={`item-${index}-${name}-error`}>{errors.items[index][name].message}</span>}</div>)}<button type="button" className="line-remove" disabled={fields.length === 1} aria-label={`Remove line item ${index + 1}`} onClick={() => remove(index)}><Trash2 size={17} /></button></div>)}</div><button className="text-link" type="button" disabled={fields.length >= 20} onClick={() => append({ description: '', quantity: '1', unitPrice: '' })}><Plus size={17} />Add Line Item</button>{errors.items?.message && <p className="field-error" role="alert">{errors.items.message}</p>}<CustomerField name="notes" label="Quotation notes (optional)" type="textarea" register={register} errors={errors} /><CustomerField name="expiresAt" label="Expiry date and time" type="datetime-local" register={register} errors={errors} /><div className="quotation-total"><span>Preview total · GMD</span><strong>{Number.isFinite(amounts.total) ? formatPrice(amounts.total) : 'Enter valid line items'}</strong></div><button type="submit" className="button button-primary">Review Quotation<ArrowRight size={17} /></button></fieldset></form>}{error && <p role="alert" className="field-error">{error}</p>}<p role="status" className="cart-feedback">{feedback}</p></div>;
}

export function AdminQuotationsPage({ search = '' }) {
  const [params] = useSearchParams();
  const workspace = useWorkspace();
  const [filter, setFilter] = useState('All');
  const filtered = workspace.quotes.filter(quote => (filter === 'All' || displayStatus(quote) === filter) && `${quote.bookingId} ${quote.version} ${quote.status}`.toLowerCase().includes(search.toLowerCase()));
  const eligible = workspace.bookings.filter(booking => ['Submitted', 'Under Review', 'Awaiting Information', 'Quoted'].includes(booking.status) && latestQuote(workspace.quotes, booking.id)?.status !== 'Accepted');
  async function onIssue(values, expectedVersion) { const quote = await issueQuotation(values, expectedVersion, workspace.demo, workspace.user); workspace.refresh(); return quote; }
  return <><div className="customer-page-heading"><div><span className="eyebrow">ADMINISTRATOR QUOTATIONS</span><h1>Clear scope. Official offers.</h1><p>Create the first quotation or issue a new numbered revision after negotiation.</p></div></div><WorkspaceState workspace={workspace}>{eligible.length ? <AdminQuotationForm key={params.get('booking') || 'all'} bookings={eligible} quotes={workspace.quotes} onIssue={onIssue} initialBookingId={eligible.find(booking => booking.id === params.get('booking'))?.id || ''} /> : <div className="dashboard-empty"><h2>No eligible bookings.</h2><p>Accepted or closed requests cannot receive an ordinary revision.</p></div>}<section className="admin-history-list"><h2>Issued quotations</h2><div className="field"><label htmlFor="quotation-status-filter">Quotation status</label><select id="quotation-status-filter" value={filter} onChange={event => setFilter(event.target.value)}>{['All', 'Sent', 'Accepted', 'Declined', 'Expired', 'Superseded'].map(status => <option key={status}>{status}</option>)}</select></div>{!filtered.length && <p className="admin-info-note">No quotations match your search or filter.</p>}{filtered.map(quote => <Link className="quotation-list-row" key={quote.id} to={`/admin/quotations/${quote.id}`}><div><strong>{quote.bookingId}</strong><span>Version {quote.version}</span></div><strong>{formatPrice(quote.total)}</strong><QuoteStatus quote={quote} /></Link>)}</section></WorkspaceState></>;
}
