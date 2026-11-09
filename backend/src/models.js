import mongoose from 'mongoose';
const { Schema } = mongoose;
const model = (name, fields, indexes = []) => {
  const schema = new Schema(fields, { timestamps: true, strict: 'throw' });
  for (const [keys, options] of indexes) schema.index(keys, options);
  return mongoose.model(name, schema);
};
export const User = model('User', {
  name: { type: String, required: true }, email: { type: String, required: true, unique: true }, phone: String,
  passwordHash: { type: String, required: true, select: false }, role: { type: String, enum: ['CUSTOMER', 'ADMIN'], default: 'CUSTOMER' },
  status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' }, verified: { type: Boolean, default: false }, authVersion: { type: Number, default: 0 },
});
export const Session = model('Session', {
  tokenHash: { type: String, unique: true }, csrf: String, userId: { type: Schema.Types.ObjectId, ref: 'User' }, authVersion: Number,
  expiresAt: { type: Date, required: true, expires: 0 },
});
export const AccountToken = model('AccountToken', {
  tokenHash: { type: String, unique: true }, userId: Schema.Types.ObjectId, purpose: { type: String, enum: ['verify', 'reset'] }, expiresAt: { type: Date, expires: 0 },
});
const history = new Schema({ title: String, status: String, at: { type: Date, default: Date.now } }, { _id: false });
export const Booking = model('Booking', {
  customerId: { type: Schema.Types.ObjectId, required: true, index: true }, requestId: String,
  reference: { type: String, unique: true }, contactPhone: String, service: String, propertyType: String, size: String, rooms: String, requirements: String,
  address: String, town: String, directions: String, date: String, time: String, description: String,
  status: { type: String, enum: ['Submitted', 'Under Review', 'Awaiting Information', 'Quoted', 'Accepted', 'Awaiting Payment', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'], default: 'Submitted' },
  photos: [{ type: Schema.Types.ObjectId, ref: 'Upload' }], revision: { type: Number, default: 0 }, currentVersion: { type: Number, default: 0 },
  acceptedQuoteId: Schema.Types.ObjectId, depositBasisPoints: Number, paidMinor: { type: Number, default: 0 }, reservedMinor: { type: Number, default: 0 },
  clarification: String, scheduledDate: String, scheduledTime: String, history: [history],
}, [[{ customerId: 1, requestId: 1 }, { unique: true }]]);
const charge = new Schema({ description: String, quantityHundredths: Number, unitMinor: Number, totalMinor: Number }, { _id: false });
export const Quotation = model('Quotation', {
  bookingId: { type: Schema.Types.ObjectId, required: true, index: true }, customerId: { type: Schema.Types.ObjectId, required: true, index: true },
  version: { type: Number, required: true }, status: { type: String, enum: ['Sent', 'Accepted', 'Declined', 'Superseded'], default: 'Sent' },
  items: { type: [charge], immutable: true }, totalMinor: { type: Number, immutable: true }, notes: { type: String, immutable: true },
  issuedAt: { type: Date, immutable: true }, expiresAt: { type: Date, immutable: true }, acceptedAt: Date,
}, [[{ bookingId: 1, version: 1 }, { unique: true }]]);
export const Settings = model('Settings', { key: { type: String, unique: true }, revision: { type: Number, default: 0 }, values: Schema.Types.Mixed });
export const Audit = model('Audit', { actorId: Schema.Types.ObjectId, action: String, resourceId: String, revision: Number });
export const Conversation = model('Conversation', { bookingId: { type: Schema.Types.ObjectId, unique: true }, customerId: Schema.Types.ObjectId, sequence: { type: Number, default: 0 }, readCustomer: { type: Number, default: 0 }, readAdmin: { type: Number, default: 0 } });
export const Message = model('Message', { bookingId: { type: Schema.Types.ObjectId, index: true }, customerId: Schema.Types.ObjectId, authorId: Schema.Types.ObjectId, role: { type: String, enum: ['CUSTOMER', 'ADMIN'] }, clientRequestId: String, sequence: Number, type: { type: String, enum: ['text', 'quotation'] }, text: String, quotationId: Schema.Types.ObjectId, attachments: [Schema.Types.ObjectId] }, [[{ authorId: 1, clientRequestId: 1 }, { unique: true }], [{ bookingId: 1, sequence: 1 }, { unique: true }]]);
export const Upload = model('Upload', { ownerId: { type: Schema.Types.ObjectId, index: true }, purpose: { type: String, enum: ['booking-photo', 'conversation-attachment', 'service-image', 'product-image'] }, bookingId: Schema.Types.ObjectId, attachedTo: Schema.Types.ObjectId, publicId: String, format: String, name: String, type: String, size: Number, private: Boolean });
export const Product = model('Product', { slug: { type: String, unique: true }, name: String, description: String, category: String, priceMinor: Number, stock: { type: Number, min: 0 }, images: [Schema.Types.ObjectId], enabled: Boolean, revision: { type: Number, default: 1 } });
export const Service = model('Service', { slug: { type: String, unique: true }, name: String, description: String, overview: String, images: [Schema.Types.ObjectId], enabled: Boolean, revision: { type: Number, default: 1 } });
export const Order = model('Order', {
  customerId: { type: Schema.Types.ObjectId, index: true }, reference: { type: String, unique: true }, requestId: String, payloadHash: String,
  items: [new Schema({ productId: Schema.Types.ObjectId, name: String, quantity: Number, unitMinor: Number, totalMinor: Number }, { _id: false })],
  customer: new Schema({ name: String, email: String, phone: String }, { _id: false }), fulfilment: { type: String, enum: ['delivery', 'pickup'] },
  deliveryAddress: new Schema({ address: String, town: String }, { _id: false }), pickupLocation: String,
  subtotalMinor: Number, deliveryMinor: Number, totalMinor: Number, paidMinor: { type: Number, default: 0 }, reservedMinor: { type: Number, default: 0 },
  paymentStatus: { type: String, default: 'Pending' }, status: { type: String, default: 'Processing' }, revision: { type: Number, default: 1 },
  reservationExpiresAt: Date, stockReleased: { type: Boolean, default: false }, simulated: { type: Boolean, default: false }, timeline: [history],
}, [[{ customerId: 1, requestId: 1 }, { unique: true }]]);
export const Payment = model('Payment', {
  customerId: { type: Schema.Types.ObjectId, index: true }, requestId: String, payloadHash: String, bookingId: Schema.Types.ObjectId, quotationId: Schema.Types.ObjectId, orderId: Schema.Types.ObjectId,
  reference: { type: String, unique: true }, amountMinor: Number, choice: String, provider: { type: String, enum: ['mock', 'wave', 'aps'] },
  status: { type: String, enum: ['Pending', 'Processing', 'Paid', 'Failed', 'Refunded'], default: 'Processing' }, providerReference: String, simulated: Boolean,
}, [[{ customerId: 1, requestId: 1 }, { unique: true }]]);
export const publicUser = user => ({ id: String(user._id), name: user.name, email: user.email, phone: user.phone || '', role: user.role, status: user.status, emailVerified: Boolean(user.verified) });
export async function initializeModels() { for (const entry of Object.values(mongoose.models)) await entry.createIndexes(); }
