export function customerNotifications({ bookings = [], payments = [], orders = [], cleaningSummaries = [] }) {
  const notifications = [];
  for (const booking of bookings) {
    for (const [index, event] of (booking.history || []).entries()) notifications.push({ id: `booking-${booking.id}-${index}`, title: `${booking.reference || booking.id}: ${event.title}`, createdAt: event.at || booking.createdAt, href: `/dashboard/bookings/${booking.id}`, simulated: /simulated/i.test(event.title) });
    const summary = cleaningSummaries.find(item => item.bookingId === booking.id);
    if (booking.status === 'Completed' && summary?.outstanding > 0) notifications.push({ id: `balance-${booking.id}`, title: 'Cleaning completed: your remaining balance is available to pay.', createdAt: booking.updatedAt || booking.createdAt, href: `/dashboard/payments?quotation=${summary.quotationId}`, simulated: payments.some(payment => payment.bookingId === booking.id && payment.simulated) });
  }
  for (const payment of payments) notifications.push({ id: `payment-${payment.id}`, title: `${payment.simulated ? 'Simulated payment' : 'Payment'} ${payment.status.toLowerCase()}: ${payment.reference}`, createdAt: payment.createdAt, href: payment.orderId ? `/dashboard/orders/${payment.orderId}` : `/dashboard/payments?quotation=${payment.quotationId}`, simulated: Boolean(payment.simulated) });
  for (const order of orders) for (const [index, event] of (order.timeline || []).entries()) notifications.push({ id: `order-${order.id}-${index}`, title: `${order.reference}: ${event.title}`, createdAt: event.at || order.createdAt, href: `/dashboard/orders/${order.id}`, simulated: Boolean(order.simulated) });
  return notifications.filter(item => Number.isFinite(Date.parse(item.createdAt))).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)).slice(0, 100);
}
