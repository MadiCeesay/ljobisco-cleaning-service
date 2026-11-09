import { useEffect, useState } from 'react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { BUSINESS_WHATSAPP } from '../services/whatsapp';
import { apiConfigured, apiRequest } from '../services/apiClient';
import { whatsappLink, customerContactAllowed } from '../services/whatsapp';
import { useAuth } from '../features/customer/authStore';
import { useAdmin } from '../features/admin/AdminContext';
import './whatsapp.css';

function ContactAction({ number, bookingReference, quotationVersion, administrator, unavailable }) {
  const href = whatsappLink(number, { bookingReference, quotationVersion, administrator });
  return <div className="whatsapp-action">{href ? <a className="button button-whatsapp" href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><WhatsAppIcon />Chat on WhatsApp<span className="sr-only"> (opens in a new tab)</span></a> : <><button className="button button-outline" type="button" disabled>Chat on WhatsApp</button><p className="form-hint" role="status">{unavailable || 'WhatsApp configuration required. The official business number is not available.'}</p></>}</div>;
}

export function BusinessWhatsApp({ bookingReference, quotationVersion }) {
  const demo = useAuth(state => state.demo);
  const [contact, setContact] = useState({ number: BUSINESS_WHATSAPP, message: '' });
  useEffect(() => {
    let active = true;
    if (!apiConfigured || demo) { setContact({ number: BUSINESS_WHATSAPP, message: '' }); return () => { active = false; }; }
    apiRequest('/business').then(data => { if (active) setContact({ number: data.whatsappNumber || BUSINESS_WHATSAPP, message: '' }); }).catch(() => { if (active) setContact({ number: BUSINESS_WHATSAPP, message: '' }); });
    return () => { active = false; };
  }, [demo]);
  return <ContactAction number={contact.number} bookingReference={bookingReference} quotationVersion={quotationVersion} unavailable={contact.message} />;
}

export function BookingWhatsApp({ booking, quotationVersion }) {
  const administrator = useAuth(state => state.user?.role === 'ADMIN');
  const admin = useAdmin();
  const reference = booking.reference || booking.id;
  if (!administrator) return <BusinessWhatsApp bookingReference={reference} quotationVersion={quotationVersion} />;
  const customer = admin?.data?.customers.find(item => item.id === booking.customerId);
  const allowed = customerContactAllowed(customer, booking);
  return <><ContactAction number={allowed ? booking.contactPhone || customer.phone : ''} bookingReference={reference} quotationVersion={quotationVersion} administrator unavailable="WhatsApp contact requires an active customer, an open related booking and a valid international customer phone number." />{allowed && <p className="form-hint">Contact only about this request when appropriate. Opening WhatsApp does not send a message or change the booking.</p>}</>;
}
