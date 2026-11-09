import { BookingWhatsApp } from '../../components/WhatsAppAction';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ClipboardList, FileCheck2, MessageSquare, CreditCard } from 'lucide-react';
import { useAuth } from './authStore';
import { useCustomerData } from './customerData';
import { CustomerField } from './AccountPages';
import { profileSchema, bookingStates } from './validation';
import { updateProfile } from './authService';
import { services } from '../../data/services';

export const serviceName = slug => services.find(service => service.slug === slug)?.name || 'Cleaning request';
export function StatusBadge({ status }) { return <span className="booking-badge">{bookingStates.includes(status) ? status : 'Status unavailable'}</span>; }

function DashboardGate({ children }) {
  const { loading, loaded, error, load } = useCustomerData();
  const demo = useAuth(state => state.demo);
  if (error) return <div className="notice error-notice" role="alert"><p>{error}</p><button className="button button-outline" type="button" onClick={() => load(demo)}>Try Again</button></div>;
  if (loading || !loaded) return <p role="status">Loading your account information…</p>;
  return children;
}

function BookingList({ bookings }) {
  return bookings.length ? <div className="booking-list">{bookings.map(booking => <Link className="booking-row" key={booking.id} to={`/dashboard/bookings/${booking.id}`}><div><strong>{serviceName(booking.service)}</strong><span>{booking.id.startsWith('demo-') ? 'Demo request' : `Request ${booking.id}`} · {booking.propertyType}</span></div><StatusBadge status={booking.status} /><ArrowRight size={17} aria-hidden="true" /></Link>)}</div> : <div className="dashboard-empty"><ClipboardList size={30} aria-hidden="true" /><h2>No cleaning requests yet.</h2><p>Tell us about your space to start a request.</p><Link to="/bookings/new" className="button button-primary">Request a Quote</Link></div>;
}

export function DashboardOverview() {
  const account = useCustomerData();
  const data = { ...account, quotations: account.quotations.filter(quote => quote.status === 'Sent' && (!quote.expiresAt || Date.parse(quote.expiresAt) > Date.now())) };
  const user = useAuth(state => state.user);
  const active = data.bookings.filter(booking => !['Completed', 'Cancelled'].includes(booking.status));
  return <><div className="customer-page-heading"><div><span className="eyebrow">CUSTOMER OVERVIEW</span><h1>Welcome, {user.name}.</h1><p>Your cleaning requests and account updates, together.</p></div><Link className="button button-primary" to="/bookings/new">New Request<ArrowRight size={17} aria-hidden="true" /></Link></div><DashboardGate><div className="dashboard-metrics">{[[ClipboardList, active.length, 'Active requests'], [FileCheck2, data.quotations.length, 'Pending quotations'], [MessageSquare, data.bookings.filter(booking => booking.status === 'Awaiting Information').length, 'Awaiting information']].map(([Icon, value, label]) => <article key={label}><Icon size={21} aria-hidden="true" /><strong>{value}</strong><span>{label}</span></article>)}</div><div className="dashboard-section"><h2>Latest updates</h2><button className="button button-outline" type="button" onClick={() => account.load(useAuth.getState().demo)}>Refresh Updates</button>{data.notifications?.length ? <ul className="commerce-history">{data.notifications.filter(item => !item.href?.includes("/orders")).slice(0, 8).map(item => <li key={item.id}><div><Link className="text-link" to={item.href}>{item.title}</Link><p>{item.simulated ? 'Simulated · ' : ''}{new Date(item.createdAt).toLocaleString()}</p></div></li>)}</ul> : <p>No account updates yet.</p>}</div><div className="dashboard-section"><h2>Recent cleaning requests</h2><BookingList bookings={data.bookings.slice(0, 4)} /><Link className="text-link" to="/dashboard/bookings">View all requests<ArrowRight size={16} /></Link></div><div className="dashboard-summary-grid"><section><CreditCard size={23} aria-hidden="true" /><h2>Payments</h2><p>{data.payments.filter(item => item.bookingId).length ? `${data.payments.length} payment records are available.` : 'No payment records. A formal quotation must be accepted before payment.'}</p><Link className="text-link" to="/dashboard/payments">View payments</Link></section><section><FileCheck2 size={23} aria-hidden="true" /><h2>Quotations</h2><p>Your administrator prepares the first official quotation after reviewing your requirements. Prices are not calculated automatically.</p><Link className="text-link" to="/dashboard/quotations">View quotations</Link></section></div></DashboardGate></>;
}

export function BookingsPage() {
  const bookings = useCustomerData(state => state.bookings);
  return <><div className="customer-page-heading"><div><h1>My Bookings</h1><p>Review your requests and their latest reported status.</p></div><Link className="button button-primary" to="/bookings/new">New Request<ArrowRight size={17} /></Link></div><DashboardGate><BookingList bookings={bookings} /><p className="form-hint">Statuses are supplied by the service. Customers cannot set booking status or issue official quotations.</p></DashboardGate></>;
}

export function BookingDetailsPage() {
  const { id } = useParams();
  const booking = useCustomerData(state => state.bookings.find(item => item.id === id));
  return <><Link className="text-link" to="/dashboard/bookings">Back to My Bookings</Link><DashboardGate>{booking ? <><div className="customer-page-heading"><div><h1>{serviceName(booking.service)}</h1><p>{booking.id.startsWith('demo-') ? 'Development request' : 'Booking reference'}: {booking.reference || booking.id}</p></div><StatusBadge status={booking.status} /></div>{booking.clarification && <div className="notice"><p><strong>Additional information requested:</strong> {booking.clarification}</p></div>}<div className="booking-detail-card"><BookingWhatsApp booking={booking} /><h2>Your cleaning requirements</h2><dl className="review-grid">{[['Contact phone', booking.contactPhone || 'Not recorded'], ['Confirmed appointment', booking.scheduledDate ? `${booking.scheduledDate} · ${booking.scheduledTime || ''}` : 'Not confirmed'], ['Property type', booking.propertyType], ['Rooms / areas', booking.rooms || 'Not specified'], ['Location', `${booking.address}, ${booking.town}`], ['Preferred date', booking.date || 'Not specified'], ['Preferred time', booking.time], ['Description', booking.description]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h2>Photographs</h2>{booking.photos?.length ? <ul>{booking.photos.map((photo, index) => <li key={`${photo.name}-${index}`}>{photo.name}{photo.uploaded === false ? ' — local preview only, not uploaded' : ''}</li>)}</ul> : <p>No photographs attached.</p>}</div><div className="notice"><p>The administrator reviews the request and sends the first official quotation. Further photographs or clarification may be requested; an on-site visit is not required for every quotation. Preferred dates remain subject to confirmation.</p></div></> : <div className="dashboard-empty"><h1>Request not found.</h1><p>This request is not available in your current account session.</p></div>}</DashboardGate></>;
}

export function ProfilePage() {
  const { user, demo, updateUser } = useAuth();
  const [result, setResult] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: user.name, email: user.email, phone: user.phone || '' } });
  async function onSubmit(values) {
    setResult(null);
    try { const next = await updateProfile(values, demo, user); updateUser(next); setResult({ success: true, message: demo ? 'Demo profile updated in memory only.' : 'Your profile has been updated.' }); }
    catch (error) { setResult({ success: false, message: error.message }); }
  }
  return <><div className="customer-page-heading"><div><h1>Your Profile</h1><p>Your customer account information.</p></div></div><form className="profile-form booking-detail-card" noValidate onSubmit={handleSubmit(onSubmit)}><fieldset disabled={isSubmitting} className="customer-fieldset"><CustomerField name="name" label="Full name" register={register} errors={errors} autoComplete="name" /><CustomerField name="email" label="Email address" register={register} errors={errors} type="email" autoComplete="email" readOnly={!demo} hint={!demo ? "Email changes require a separately verified workflow." : undefined} /><CustomerField name="phone" label="Phone number" register={register} errors={errors} type="tel" autoComplete="tel" /><p className="form-hint">Account type: Customer. Role changes are not available here. {user.emailVerified === true ? 'Your email address is verified.' : 'Your email address is not marked as verified.'}</p><button className="button button-primary" type="submit">{isSubmitting ? 'Saving…' : 'Save Profile'}</button></fieldset><div aria-live="polite">{result && <div className={`notice ${result.success ? '' : 'error-notice'}`} role={result.success ? 'status' : 'alert'}><p>{result.message}</p></div>}</div></form></>;
}
