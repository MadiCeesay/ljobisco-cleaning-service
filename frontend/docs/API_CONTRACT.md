# Ijobisco frontend / backend API contract

Current contract for the completed local application. All domain paths are relative to /api. Backend /health and /ready are outside that prefix. Historical phase reports are superseded by MASTER_COMPLETION_REPORT.md at the repository root.

## Transport and security

Axios uses the shared cookie/CSRF/session-generation adapter. VITE_API_BASE_URL=/api and Vite's same-origin proxy target port 4000. Production requires an equivalent HTTPS API proxy. No Socket.IO or browser JWT storage is used. Every mutation obtains GET /auth/csrf and sends X-CSRF-Token, the HttpOnly cookie and an allowed Origin. Session changes cancel pending requests; mutations are not automatically replayed.

Errors are non-2xx JSON {error:{code,message,requestId}}. Known unavailable-service codes receive safe frontend messages. Unknown provider details, credentials, token values and authoritative browser-submitted amounts are never trusted. Owner/ADMIN authorization remains server-side. Currency is GMD; database arithmetic uses integer minor units; DTO amounts are display decimals.

## Authentication

| Method/path | Request | Response / rules |
| --- | --- | --- |
| GET /auth/configuration | Public | {requireEmailVerification:boolean} |
| GET /auth/csrf | Cookie context | {csrfToken}; anonymous cookie when necessary |
| GET /auth/session | Cookie | {user:SessionUser or null} |
| POST /auth/register | {name,email,password,phone?} | 201 {message,verificationRequired:false} when optional; 202 with true when required |
| POST /auth/login | {email,password} | {user}; rotates session cookie |
| POST /auth/logout | Empty | 204; revokes session |
| POST /auth/forgot-password | {email} | Neutral 202 when SMTP configured; 503 when unavailable |
| POST /auth/resend-verification | {email} | Same neutral delivery semantics |
| POST /auth/reset-password | {token,password} | 200; single-use token, session revocation |
| POST /auth/verify-email | {token} | 200; single-use verification token |
| PATCH /customer/profile | {name,email,phone} | {user}; phone may be blank, current email must remain unchanged |

SessionUser = {id,name,email,phone,role,status,emailVerified}; the frontend strips unneeded fields. Public registration only creates CUSTOMER. Passwords require eight characters and at most 72 UTF-8 bytes; confirmPassword is validated locally, never submitted. Administrator provisioning is private, requires a stronger password and is never public registration.

REQUIRE_EMAIL_VERIFICATION defaults false. Optional-verification registration creates an active CUSTOMER with verified:false, sends no email and creates no verification token. Frontend subsequently calls normal login and returns to the validated booking/checkout/dashboard destination. A duplicate normalized email returns 409 ACCOUNT_EXISTS; a unique database index protects races. Login eligibility is not email ownership.

When the flag is true, customer registration requires SMTP and login requires verification. ADMIN always requires an active verified account, independent of this flag. Session restoration rechecks policy, so enabling verification also blocks existing unverified customer sessions. No migration falsely verifies existing accounts.

Missing SMTP returns EMAIL_UNAVAILABLE. Registration mail failure in required mode returns EMAIL_DELIVERY_FAILED and may leave an unverified account; use the verification page's resend form after fixing SMTP. Recovery/resend delivery failure remains a neutral acknowledgement for known and unknown accounts; it never claims inbox delivery. Raw reset tokens never appear in public responses. Verified email changes remain a separate, unimplemented workflow.

## Public catalogue and business

- GET /services and /services/:slug: approved local descriptions plus enabled managed content. Disabled managed slugs suppress fallbacks. House Cleaning retains the home-cleaning slug. No fixed cleaning price.
- GET /products and /products/:slug: enabled database products with fixed GMD prices, stock, category, images and revision. Collection supports search/category/sort and bounded limit up to 100; frontend filters the loaded collection.
- Product = {id,slug,name,description,category,price,stock,images,enabled,revision}.
- GET /business: {companyName,tagline,email,phone,whatsappNumber,address,serviceAreas}; unconfigured contacts remain blank.
- POST /contact: {name,email,phone,subject,message}; requires configured SMTP and approved destination email. 202 {accepted:true,delivered:false,message} means SMTP accepted submission, not inbox delivery.

## Bookings and account updates

POST /bookings accepts {service,propertyType,size,rooms,requirements,contactPhone?,address,town,directions,date,time,description,requestId,photos:[{attachmentId}]}. A contact phone is required unless a valid authenticated profile phone supplies the legacy fallback. Name/email and owner derive from the authenticated customer. IDs, reference, status, history and amounts are server-controlled. Submission is idempotent per owner/request UUID.

GET /bookings/:id is owner/ADMIN-only. GET /customer/overview returns {bookings,quotations,messages:[],notifications,payments,orders,cleaningSummaries,...paymentConfiguration}. Photos are authorized metadata, not public private-image links.

Statuses preserve existing conventions: Submitted (pending review), Under Review, Awaiting Information, Quoted, Accepted, Awaiting Payment, Scheduled (confirmed appointment), In Progress, Completed, Cancelled. Preferred dates never guarantee availability. Initial payment requires formal acceptance; administrator scheduling requires confirmed initial payment; only an administrator confirms progress/completion.

GET /customer/notifications returns {notifications:[{id,title,createdAt,href,simulated}]}, newest 100 maximum. The same array is included in overview. It derives from owned booking history, formal quotation events, payments, completed outstanding balances and order timelines. There is no unread/read tracking, socket push or email-delivery claim. Refresh fetches canonical state.

## Formal quotations

GET /customer/quotations/workspace and ADMIN GET /admin/quotations/workspace return {bookings,quotes,conversations:[]}. Admin workspace also contains credential-free customers and management data.

ADMIN POST /admin/quotations accepts {bookingId,items:[{description,quantity,unitPrice}],notes,expiresAt,expectedVersion}. Decimal strings are bounded and converted to minor-unit totals. Zero expectedVersion creates version 1; N creates N+1 and supersedes the old Sent version transactionally.

CUSTOMER POST /quotations/:id/response accepts {action:'accept'|'decline',expectedVersion}. Only the owner may accept the latest valid unexpired Sent offer. Accepted content and deposit percentage are frozen; no chat or browser price changes them.

Quotation = {id,bookingId,customerId,version,status,currency,items:[{description,quantity,unitPrice,total}],total,notes,issuedAt,expiresAt,acceptedAt?}. Status is Sent, Accepted, Declined, Superseded or derived Expired. Formal history and audits remain inside Ijobisco.

## WhatsApp, not in-app chat

Only ordinary https://wa.me/<international digits>?text=<encoded fixed message> is used. Official number is administrator-configured, blank by default, normalized to an explicit +country-code format with 8–15 digits. Format checks do not verify ownership, consent or WhatsApp enrollment.

Prefilled text is restricted to fixed wording, a safe booking reference and optional quotation version. It never contains addresses, photos, customer names/emails, tokens, amounts or arbitrary customer text. External links use no-referrer, noopener and noreferrer. Opening a link does not send a message.

Administrator customer contact additionally requires matching ownership, active account, recognized open booking status and a valid booking/profile phone. Staff must contact only when appropriate for the related request.

Legacy /dashboard/messages[/:bookingId] and /admin/messages[/:bookingId] are support pages. Authenticated /conversations/* API calls return 410 CHAT_RETIRED; anonymous reads remain 401 and mutations retain CSRF. Historical Conversation/Message documents are untouched. Compatibility arrays are empty, not live unread counts. There is no active Socket.IO server, client or proxy.

## Images

POST /uploads is authenticated multipart {purpose,bookingId?,file}, returning {attachmentId,name,type,size,uploaded:true}. Purposes are booking-photo, service-image, product-image. Marketing images require ADMIN; booking photos require CUSTOMER. Up to eight booking photos, five MB per image. Actual JPEG/PNG/WebP bytes are decoded, bounded, metadata-stripped and reencoded. SVG/PDF, arbitrary remote URLs and new conversation attachments are rejected.

GET /uploads/:id authorizes private reads before a short-lived authenticated Cloudinary redirect. Marketing images may be public. DTO media URLs use the same-origin /api/uploads/:id path. Missing or failing upload providers return 503 UPLOAD_UNAVAILABLE, not an invented upload success.

## Checkout, orders and payments

GET /checkout/configuration returns approved delivery/pickup settings and mock availability. No fees, areas or pickup location are invented. Missing configuration blocks the selected method.

POST /checkout/preview and POST /orders accept {requestId,items:[{id,quantity,expectedRevision?}],details:{name,email,phone,fulfilment,address,town}}. Server revalidates products/prices/stock/fee and calculates totals. Order creation reserves stock once. Duplicate identical requests return the same order; conflicting payloads under the same key fail. Unpaid reservations expire after 30 minutes.

Order = {id,reference,customerId,items:[{productId,name,quantity,unitPrice,total}],total,subtotal,deliveryFee,fulfilment,paymentStatus,status,createdAt,revision,simulated,customer,deliveryAddress?,pickupLocation?,timeline}. GET /orders/:id is owner/ADMIN-protected.

GET /customer/payments-and-orders returns {payments,orders,depositPercentage,mockEnabled,cleaningSummaries}. Summaries expose accepted quotation total, frozen deposit percentage, paid/outstanding and backend-completion gate.

POST /payments/cleaning/intents: {quotationId,expectedVersion,choice:'deposit'|'full'|'balance',requestId,provider,mockOutcome?}.
POST /payments/orders/intents: {orderId,requestId,provider,mockOutcome?}.
GET /payments/:id: owner/ADMIN-only.

Optional mockOutcome is paid or failed, allowed only for mock provider and included in idempotency. It does not authorize arbitrary status updates: record ownership, accepted offer/order, canonical amounts and reservations are still checked before simulated settlement. All mock results, history and receipts are labelled simulated and never transfer money. Failure preserves prior successful deposits. A failed order payment retries that order, not another stock deduction.

Payment = {id,reference,providerReference?,customerId,bookingId?,quotationId?,orderId?,amount,currency,method,provider,status,createdAt,simulated}. Frontend distinguishes pending, processing, partial payment, paid, failed and refunded; refunds are display-only until a separate authorized refund integration exists.

Default deposit is 30%, configurable through settings and frozen at acceptance. The remaining balance becomes payable only after administrator-confirmed completion. Full payment leaves zero balance. Amounts are never submitted by the client.

Backend mock requires explicit MOCK_PAYMENTS_ENABLED=true with non-production loopback configuration. Frontend additionally requires development build and VITE_LOCAL_MOCK_PAYMENTS=true. Production rejects mock enablement. Wave/APS remain disabled. An unpaid order or frontend click never implies payment success.

## Administrator operations

Backend ADMIN authorization is required, not just a route guard. GET /admin/workspace returns {bookings,quotes,conversations:[],services,products,customers,orders,payments,balances,settings,settingsRevision}. GET /admin/statistics derives database counts; frontend overview additionally derives pending/confirmed/in-progress/completed counts. No fabricated revenue is shown.

- POST /admin/services[/:id] and /admin/products[/:id]: {kind,id?,values,images,expectedRevision}.
- POST /admin/settings: {values,expectedRevision}; includes optional official whatsappNumber, company/contact, service areas, deposit and fulfilment settings.
- POST /admin/bookings/:id/information-requests: {id,expectedRevision,values:{message}}; saves full clarification in private booking history and an audit event, not a chat.
- POST /admin/bookings/:id/schedule: {id,expectedRevision,values:{date,time,status,note}}; payment/completion/status rules enforced.
- POST /admin/orders/:id/fulfilment: {id,expectedRevision,values:{status,note}}; paid prerequisite, correct fulfilment method and safe cancellation rules.
- POST /admin/customers/:id/status: {status,expectedRevision}; active/disabled, credential-free result and session revocation.
- GET /admin/payments: safe payment projection; complete relationships in workspace.

Mutations return {record}; stale revisions return 409. No employee/cleaner accounts, assignment, availability, payroll, GPS, marketplace or live payment APIs are implemented.

## Fixtures and verification limits

Connected mode disables demo adapters even during development. Production additionally removes fixture loaders. Cart storage contains identifiers and quantities only, with separate live/demo keys. Private drafts and sessions remain in memory/cookies, not JWT localStorage.

See MASTER_COMPLETION_REPORT.md for actual executed checks and required configuration. Disposable MongoDB browser tests are not authenticated Atlas or real SMTP/Cloudinary/provider certification.
# Cleaning-only update (November 2026)

Booking review offers Approve Request for unapproved requests without quotations. It calls `POST /admin/bookings/:id/approve` with `{ id, expectedRevision }` through the normal cookie/CSRF adapter after confirmation. Persisted `requestApprovedAt` is displayed as approval for quotation, not customer quotation acceptance. The next action is Create Quotation; historical quoted requests retain revision controls.

Administrator booking review uses `balances[].canSchedule` from `/admin/workspace` to reveal the compact scheduling form only after confirmed required payment. Missing eligibility fails closed. Start/completion actions use the existing schedule endpoint with the recorded appointment, expected revision and explicit audit note. Quotation links may supply `?booking=<id>` to preselect an eligible booking; this does not issue or accept a quotation.

Property type is no longer collected in the cleaning request form. `propertyType` may be omitted or empty; the backend stores no inferred property category. Historical enum values remain accepted for compatibility.

The active website no longer exposes shop, cart, checkout or product-order routes; legacy URLs redirect to `/services`. Historical commerce API records are retained, not deleted.

`POST /bookings` now accepts an empty string for `rooms` and `date` when the customer has not specified them. Neither is fabricated. Other request fields and authentication/CSRF requirements are unchanged. The three-step form sends blank legacy optional size/requirements/directions and `time: "Flexible"`. A submitted request is not a confirmed appointment or quotation.

`GET /business` returns the administrator-configured WhatsApp number when nonempty, otherwise the owner-approved `+2205393273`. The same approved fallback keeps support links available during API outages. Links open `https://wa.me/2205393273` with an encoded, nonsensitive enquiry; the user must send it in WhatsApp.

