import { BookingWhatsApp } from '../../components/WhatsAppAction';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, FileCheck2, CalendarClock, MessageSquare, CreditCard } from 'lucide-react';
import { useAdmin } from './AdminLayout';
import { AdminHeading, Table, Filter, StatusBadge, EmptyState, CustomerName, AuditHistory, useConfirmation } from './components';
import { filterRecords, informationSchema, scheduleSchema, safeImageUrl, orderUpdateSchema, orderStatuses } from './rules';
import { bookingStates } from '../customer/validation';
import { CustomerField } from '../customer/AccountPages';
import { AdminQuotationsPage } from '../quotations/AdminQuotationEditor';
import { MessagingPage } from '../quotations/MessagingPage';
import { latestQuote } from '../quotations/rules';
import { formatPrice } from '../../services/catalog';
import { quoteDate } from '../quotations/QuotationPages';

const date = value => value ? quoteDate(value) : 'Not provided';
function bookingTitle(booking, data) { return data.services.find(item => item.slug === booking.service)?.name || booking.service; }
function bookingColumns(data) { return [
  { label: 'Request', render: booking => <><Link to={`/admin/bookings/${booking.id}`}>{bookingTitle(booking, data)}</Link><small>{booking.id}</small></> },
  { label: 'Customer', render: booking => <CustomerName id={booking.customerId} /> },
  { label: 'Property', render: booking => <>{booking.propertyType}<small>{booking.town} · {booking.rooms} rooms / areas</small></> },
  { label: 'Status', render: booking => <StatusBadge status={booking.status} /> },
  { label: 'Requested', render: booking => date(booking.createdAt) },
  { label: 'Action', render: booking => <Link to={`/admin/bookings/${booking.id}`}>Review Request</Link> },
]; }
export function AdminOverview() {
  const { data, demo, search } = useAdmin();
  const latest = data.quotes.filter(quote => latestQuote(data.quotes, quote.bookingId)?.id === quote.id);
  const pending = latest.filter(quote => quote.status === 'Sent' && Date.parse(quote.expiresAt) > Date.now());
  const outstanding = data.balances.reduce((sum, balance) => sum + balance.outstanding, 0);
  const metrics = [
    ['Cleaning requests', data.bookings.length, 'All submitted requests', '/admin/bookings', ClipboardList],
    ['Pending quotations', pending.length, 'Latest valid offers awaiting response', '/admin/quotations', FileCheck2],
    ['Active bookings', data.bookings.filter(booking => ['Scheduled', 'In Progress'].includes(booking.status)).length, 'Scheduled or in progress', '/admin/bookings', CalendarClock],
    ['Pending requests', data.bookings.filter(booking => ['Submitted', 'Under Review'].includes(booking.status)).length, 'Awaiting administrator review', '/admin/bookings', MessageSquare],
    ['Outstanding payments', formatPrice(outstanding), 'Outstanding on accepted cleaning quotations', '/admin/payments', CreditCard],
    ['Confirmed appointments', data.bookings.filter(booking => booking.status === 'Scheduled').length, 'Administrator-confirmed date and time', '/admin/bookings', CalendarClock],
    ['Cleaning in progress', data.bookings.filter(booking => booking.status === 'In Progress').length, 'Administrator-confirmed progress', '/admin/bookings', ClipboardList],
    ['Completed cleanings', data.bookings.filter(booking => booking.status === 'Completed').length, 'Completion confirmed by administrator', '/admin/bookings', FileCheck2],
  ];
  const bookings = filterRecords(data.bookings, search, 'All', ['id', 'service', 'town']).slice().sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)).slice(0, 5);
  return <><AdminHeading title="Business overview" description={demo ? 'A clear view of your local development workspace — not live statistics.' : 'Figures returned by the administrator backend.'} /><div className="admin-metrics">{metrics.map(([label, value, hint, href, Icon]) => <Link to={href} className="admin-metric" key={label}><div className="admin-metric-top"><span>{label}</span><Icon size={18} aria-hidden="true" /></div><strong>{value}</strong><small>{hint}</small></Link>)}</div><div className="admin-two-column"><section className="admin-panel"><div className="admin-panel-title"><h2>Recent cleaning requests</h2><Link className="text-link" to="/admin/bookings">View All</Link></div><Table caption="Recent requests matching the current page search" columns={bookingColumns(data).filter(column => !['Requested', 'Customer'].includes(column.label))} records={bookings} /></section><aside><section className="admin-panel"><h2>Administrator workflow</h2><p>Review the request, clarify the scope, then issue a formal quotation. Scheduling requires accepted scope and confirmed payment.</p><Link className="text-link" to="/admin/quotations">Open Quotation Editor</Link></section></aside></div></>;
}
export function AdminBookingsPage() {
  const { data, search } = useAdmin();
  const [status, setStatus] = useState('All');
  const records = filterRecords(data.bookings, search, status, ['id', 'service', 'town', 'address', 'propertyType']);
  return <><AdminHeading title="Cleaning requests" description="Review requirements, request clarification and manage confirmed schedules." /><section className="admin-panel"><Filter status={status} setStatus={setStatus} statuses={bookingStates} count={records.length} /><Table caption="Cleaning requests" columns={bookingColumns(data)} records={records} /></section></>;
}
function BookingActions({ booking }) {
  const { mutate } = useAdmin();
  const [feedback, setFeedback] = useState('');
  const confirmation = useConfirmation();
  const information = useForm({ resolver: zodResolver(informationSchema), defaultValues: { message: '' } });
  const scheduling = useForm({ resolver: zodResolver(scheduleSchema), defaultValues: { date: booking.scheduledDate || '', time: booking.scheduledTime || '', status: booking.status === 'Scheduled' ? 'In Progress' : booking.status === 'In Progress' ? 'Completed' : 'Scheduled', note: '' } });
  const closed = ['Completed', 'Cancelled'].includes(booking.status);
  const submit = (operation, values, title) => confirmation.confirm({ title, description: `${booking.id}\n${operation === 'booking-information' ? values.message : `${values.status} · ${values.date} · ${values.time}\n${values.note}`}\nThis change must be confirmed by the administrator service.`, onConfirm: async () => { await mutate(operation, { id: booking.id, values, expectedRevision: booking.revision || 0 }); setFeedback('The administrator adapter confirmed the change.'); information.reset(); } });
  return <><div className="admin-two-column equal"><section className="admin-panel"><h2>Request additional information</h2><p className="admin-info-note">Ask for clarification or more photographs in the booking record, then contact the customer through WhatsApp. An on-site inspection is not mandatory for every quotation.</p><form noValidate onSubmit={information.handleSubmit(values => submit('booking-information', values, 'Send information request?'))}><fieldset className="customer-fieldset" disabled={closed || ['Scheduled', 'In Progress'].includes(booking.status)}><CustomerField name="message" label="Information needed" type="textarea" register={information.register} errors={information.formState.errors} /><button className="button button-outline" type="submit">Review Information Request</button></fieldset></form><p><BookingWhatsApp booking={booking} /></p></section><section className="admin-panel"><h2>Scheduling and progress</h2><p className="admin-info-note">Preferred dates are requests, not guaranteed appointments. Only the adapter/backend can confirm scheduling and completion.</p><form noValidate onSubmit={scheduling.handleSubmit(values => submit('booking-schedule', values, 'Update booking schedule?'))}><fieldset className="customer-fieldset" disabled={closed}><div className="admin-form-grid"><CustomerField name="date" label="Confirmed scheduling date" type="date" register={scheduling.register} errors={scheduling.formState.errors} /><CustomerField name="time" label="Confirmed time window" register={scheduling.register} errors={scheduling.formState.errors} /><CustomerField name="status" label="Booking update" register={scheduling.register} errors={scheduling.formState.errors}>{['Scheduled', 'In Progress', 'Completed', 'Cancelled'].map(status => <option key={status}>{status}</option>)}</CustomerField><CustomerField name="note" label="Change reason" type="textarea" register={scheduling.register} errors={scheduling.formState.errors} /></div><button type="submit" className="button button-primary admin-form-actions">Review Schedule Change</button></fieldset></form></section></div>{closed && <p className="admin-info-note">This booking is closed. Further changes require a separately authorized backend workflow.</p>}<p role="status" className="admin-info-note">{feedback}</p>{confirmation.dialog}</>;
}
export function AdminBookingDetails() {
  const { id } = useParams();
  const { data } = useAdmin();
  const booking = data.bookings.find(item => item.id === id);
  if (!booking) return <EmptyState title="Booking not found.">The request is unavailable in this workspace.</EmptyState>;
  const details = [['Customer', <CustomerName id={booking.customerId} />], ['Contact phone', booking.contactPhone || data.customers.find(customer => customer.id === booking.customerId)?.phone || 'Not supplied'], ['Status', <StatusBadge status={booking.status} />], ['Property', `${booking.propertyType} · ${booking.rooms} rooms / areas`], ['Approximate size', booking.size ? `${booking.size} m²` : 'Not provided'], ['Address', `${booking.address}, ${booking.town}`], ['Access and directions', booking.directions || 'Not provided'], ['Preferred date', booking.date || 'Not provided'], ['Preferred time', booking.time || 'Not provided'], ['Confirmed schedule', booking.scheduledDate ? `${booking.scheduledDate} · ${booking.scheduledTime}` : 'Not scheduled'], ['Cleaning description', booking.description], ['Special requirements', booking.requirements || 'Not provided'], ['Additional information request', booking.clarification || 'None']];
  return <><Link className="text-link" to="/admin/bookings">Back to Requests</Link><AdminHeading title={bookingTitle(booking, data)} description={`Booking reference: ${booking.reference || booking.id}`} /><section className="admin-panel"><h2>Customer-submitted details</h2><dl className="admin-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>Property photographs</h3>{booking.photos?.length ? <div className="admin-image-grid">{booking.photos.map((photo, index) => (safeImageUrl(photo.url) && photo.uploaded !== false) || safeImageUrl(photo.previewUrl) ? <a key={index} className="admin-image-tile" href={safeImageUrl(photo.previewUrl || photo.url)} target="_blank" rel="noreferrer"><img src={safeImageUrl(photo.previewUrl || photo.url)} alt={photo.name || `Property photograph ${index + 1}`} /><span>{photo.name || `Photograph ${index + 1}`}{photo.uploaded === false ? ' · Local preview only, not uploaded' : ''}</span></a> : <div className="admin-image-tile" key={index}><span>{photo.name || `Photograph ${index + 1}`} — not uploaded; preview unavailable.</span></div>)}</div> : <p className="admin-info-note">No photographs supplied.</p>}<p><Link className="text-link" to="/admin/quotations">Manage Formal Quotations</Link></p></section><BookingActions key={`${booking.id}-${booking.revision || 0}`} booking={booking} /><section className="admin-panel"><h2>Booking history</h2><AuditHistory items={[{ title: 'Cleaning request submitted', at: booking.createdAt }, ...(booking.history || [])]} /></section></>;
}
export function AdminQuotationWorkspace() { const { search } = useAdmin(); return <AdminQuotationsPage search={search} />; }
export function AdminConversationWorkspace() { const { search } = useAdmin(); return <MessagingPage search={search} />; }

function orderColumns() { return [
  { label: 'Order', render: order => <><Link to={`/admin/orders/${order.id}`}>Review Order</Link><small>{order.id}</small></> },
  { label: 'Customer', render: order => <CustomerName id={order.customerId} /> },
  { label: 'Fulfilment', render: order => order.fulfilment },
  { label: 'Total (GMD)', render: order => <span className="admin-money">{formatPrice(order.total)}</span> },
  { label: 'Payment', render: order => <StatusBadge status={order.paymentStatus} /> },
  { label: 'Order status', render: order => <StatusBadge status={order.status} /> },
]; }
export function AdminOrdersPage() {
  const { data, search } = useAdmin();
  const [status, setStatus] = useState('All');
  const records = filterRecords(data.orders, search, status, ['id', 'customerId', 'fulfilment', 'paymentStatus']);
  return <><AdminHeading title="Product orders" description="Review fulfilment preferences, payment records and order progress." /><section className="admin-panel"><Filter status={status} setStatus={setStatus} statuses={orderStatuses} count={records.length} /><Table caption="Product orders" columns={orderColumns()} records={records} empty={<EmptyState title={data.orders.length ? 'No matching orders.' : 'No product orders yet.'}>Orders appear when the order service returns them. Demo checkout can create local test orders.</EmptyState>} /></section></>;
}
function OrderActions({ order }) {
  const { mutate } = useAdmin();
  const [feedback, setFeedback] = useState('');
  const confirmation = useConfirmation();
  const form = useForm({ resolver: zodResolver(orderUpdateSchema), defaultValues: { status: 'On Hold', note: '' } });
  return <section className="admin-panel"><h2>Update fulfilment</h2><p className="admin-info-note">Changing fulfilment never changes payment status or triggers a payment/refund. Unconfigured fulfilment cannot progress.</p><form noValidate onSubmit={form.handleSubmit(values => confirmation.confirm({ title: 'Update order fulfilment?', description: `${order.id}\n${values.status}\n${values.note}`, onConfirm: async () => { await mutate('order-status', { id: order.id, values, expectedRevision: order.revision || 0 }); setFeedback('The administrator adapter confirmed the fulfilment update.'); } }))}><fieldset className="customer-fieldset" disabled={['Completed', 'Cancelled'].includes(order.status)}><CustomerField name="status" label="Fulfilment status" register={form.register} errors={form.formState.errors}>{orderStatuses.map(status => <option key={status}>{status}</option>)}</CustomerField><CustomerField name="note" label="Fulfilment change reason" type="textarea" register={form.register} errors={form.formState.errors} /><button className="button button-primary" type="submit">Review Fulfilment Change</button></fieldset></form><p role="status">{feedback}</p>{confirmation.dialog}</section>;
}
export function AdminOrderDetails() {
  const { id } = useParams();
  const { data } = useAdmin();
  const order = data.orders.find(item => item.id === id);
  if (!order) return <EmptyState title="Order not found.">This order is unavailable in this workspace.</EmptyState>;
  return <><Link className="text-link" to="/admin/orders">Back to Orders</Link><AdminHeading title="Order details" description={`Reference: ${order.id}`} /><div className="admin-two-column"><div><section className="admin-panel"><h2>Purchased products</h2><Table caption="Order line items — recorded unit prices in GMD" records={order.items} rowKey="productId" columns={[{ label: 'Product', render: item => item.name }, { label: 'Quantity', render: item => item.quantity }, { label: 'Unit price', render: item => formatPrice(item.unitPrice) }, { label: 'Total', render: item => formatPrice(item.total) }]} /><p><strong>{order.simulated ? 'Simulated products subtotal' : 'Order total'}: {formatPrice(order.total)}</strong></p>{order.simulated && <p className="admin-info-note">No real payment or fulfilment. The demo subtotal excludes unconfigured delivery charges.</p>}</section><section className="admin-panel"><h2>Customer and fulfilment</h2><dl className="admin-details">{[['Customer account', <CustomerName id={order.customerId} />], ['Checkout name', order.customer?.name || 'Not retained in this record'], ['Checkout email', order.customer?.email || 'Not provided'], ['Checkout phone', order.customer?.phone || 'Not provided'], ['Method', order.fulfilment], ['Delivery address', order.deliveryAddress ? `${order.deliveryAddress.address}, ${order.deliveryAddress.town}` : 'Not applicable / not provided'], ['Pickup location', order.pickupLocation || 'Not confirmed'], ['Order status', <StatusBadge status={order.status} />], ['Payment status', <StatusBadge status={order.paymentStatus} />]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="admin-info-note">Customer information is private. Only backend-authorized administrators may access live records.</p></section><OrderActions key={`${order.id}-${order.revision || 0}`} order={order} /></div><aside className="admin-panel"><h2>Order timeline</h2><AuditHistory items={order.timeline} /></aside></div></>;
}
export function AdminCustomersPage() {
  const { data, search } = useAdmin();
  const [status, setStatus] = useState('All');
  const records = filterRecords(data.customers, search, status, ['name', 'email', 'phone', 'id']);
  return <><AdminHeading title="Customers" description="Account details and service history, without exposing authentication credentials." /><section className="admin-panel"><Filter status={status} setStatus={setStatus} statuses={['Active', 'Suspended', 'Pending Verification']} count={records.length} /><Table caption="Customer accounts" records={records} columns={[{ label: 'Customer', render: customer => <><Link to={`/admin/customers/${customer.id}`}>{customer.name}</Link><small>{customer.id}</small></> }, { label: 'Contact', render: customer => <>{customer.email}<small>{customer.phone}</small></> }, { label: 'Account status', render: customer => <StatusBadge status={customer.status} /> }, { label: 'Action', render: customer => <Link to={`/admin/customers/${customer.id}`}>View History</Link> }]} /></section></>;
}
export function AdminCustomerDetails() {
  const { id } = useParams();
  const { data } = useAdmin();
  const customer = data.customers.find(item => item.id === id);
  if (!customer) return <EmptyState title="Customer not found.">This account is unavailable in this workspace.</EmptyState>;
  const bookings = data.bookings.filter(booking => booking.customerId === id);
  return <><Link className="text-link" to="/admin/customers">Back to Customers</Link><AdminHeading title={customer.name} description={`Customer reference: ${customer.id}`} /><section className="admin-panel"><h2>Account details</h2><dl className="admin-details">{[['Full name', customer.name], ['Email', customer.email], ['Phone', customer.phone], ['Account status', <StatusBadge status={customer.status} />]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl><p className="admin-info-note">Passwords, session tokens and authentication secrets are never requested or displayed here.</p></section><section className="admin-panel"><h2>Booking history</h2><Table caption="Customer booking history" records={bookings} columns={bookingColumns(data).filter(column => column.label !== 'Customer')} /></section></>;
}
export function AdminPaymentsPage() {
  const { data, search } = useAdmin();
  const [status, setStatus] = useState('All');
  const records = filterRecords(data.payments.filter(item => item.bookingId), search, status, ['id', 'bookingId', 'customerId', 'method']);
  return <><AdminHeading title="Payments and balances" description="Read-only payment information. Status is supplied by the payment service, never set by a frontend button." /><section className="admin-panel"><h2>Outstanding cleaning balances</h2><Table caption="Balances on accepted cleaning quotations — preview only in development" records={data.balances.filter(balance => balance.outstanding > 0)} rowKey="bookingId" columns={[{ label: 'Booking', render: item => <Link to={`/admin/bookings/${item.bookingId}`}>{item.bookingId}</Link> }, { label: 'Customer', render: item => <CustomerName id={item.customerId} /> }, { label: 'Total', render: item => formatPrice(item.total) }, { label: 'Paid', render: item => formatPrice(item.paid) }, { label: 'Outstanding', render: item => formatPrice(item.outstanding) }]} empty={<EmptyState title="No outstanding balances.">Accepted cleaning quotations and confirmed payments determine balances.</EmptyState>} /></section><section className="admin-panel"><h2>Payment records</h2><Filter status={status} setStatus={setStatus} statuses={['Pending', 'Processing', 'Partially Paid', 'Paid', 'Failed', 'Refunded']} count={records.length} /><Table caption="Payment records" records={records} columns={[{ label: 'Reference', render: item => <span className="admin-reference">{item.id}</span> }, { label: 'Related record', render: item => item.orderId ? <Link to={`/admin/orders/${item.orderId}`}>Product Order</Link> : <Link to={`/admin/bookings/${item.bookingId}`}>{item.bookingId}</Link> }, { label: 'Customer', render: item => <CustomerName id={item.customerId} /> }, { label: 'Amount (GMD)', render: item => <span className="admin-money">{formatPrice(item.amount)}</span> }, { label: 'Method', render: item => item.method }, { label: 'Status', render: item => <StatusBadge status={item.status} /> }, { label: 'Recorded', render: item => date(item.createdAt) }]} empty={<EmptyState title={data.payments.length ? 'No matching payments.' : 'No payment records yet.'}>Only adapter-confirmed transactions appear here.</EmptyState>} /></section></>;
}
