import { Link, useParams } from 'react-router-dom';
import { useWorkspace } from './useWorkspace';
import { WorkspaceState } from './QuotationPages';
import { BookingWhatsApp, BusinessWhatsApp } from '../../components/WhatsAppAction';

export function MessagingPage({ search = '' }) {
  const workspace = useWorkspace();
  const { bookingId } = useParams();
  const admin = workspace.user.role === 'ADMIN';
  const prefix = admin ? '/admin' : '/dashboard';
  const bookings = workspace.bookings.filter(booking => (!bookingId || booking.id === bookingId) && `${booking.reference || booking.id} ${booking.service}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="customer-page-heading"><div><span className="eyebrow">WHATSAPP SUPPORT</span><h1>Let’s work through the details.</h1><p>Discuss your request on WhatsApp. Official quotations, acceptance and payments remain in your Ijobisco account.</p></div><button className="button button-outline" onClick={workspace.refresh}>Refresh</button></div><WorkspaceState workspace={workspace}>{!admin && <section className="booking-detail-card"><h2>Contact Ijobisco</h2><BusinessWhatsApp /><p className="form-hint">WhatsApp opens externally. Review the message before sending. Do not share passwords or payment credentials.</p></section>}<section className="booking-detail-card"><h2>Booking support</h2>{bookings.length ? <div className="booking-list">{bookings.map(booking => <article key={booking.id} className="booking-detail-card"><Link className="text-link" to={`${prefix}/bookings/${booking.id}`}>{booking.reference || booking.id}</Link><p>{booking.status}</p><BookingWhatsApp booking={booking} /></article>)}</div> : <p>No matching bookings are available in your account.</p>}</section><p className="form-hint">WhatsApp messages are not stored or monitored by this application and never accept or revise a quotation. Return here and refresh to see administrator-confirmed updates.</p></WorkspaceState></>;
}
