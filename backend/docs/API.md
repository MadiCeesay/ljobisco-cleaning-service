# Backend API

The canonical current request/response contract is frontend/docs/API_CONTRACT.md (from repository root). It covers all implemented public, account, booking, quotation, WhatsApp, upload, commerce, payment and administrator endpoints. MASTER_COMPLETION_REPORT.md records actual verification and limits.

## Backend invariants

- Domain routes use /api; /health and /ready are separate. Readiness performs a fresh MongoDB ping. Startup connects to a transaction-capable database before listening.
- Authentication uses opaque hashed server sessions, HttpOnly cookies, expiry/revocation, strict allowed origins and synchronizer CSRF. No localStorage JWT or public administrator signup.
- REQUIRE_EMAIL_VERIFICATION=false permits active unverified CUSTOMER accounts to log in without SMTP. Stored email verification remains false. ADMIN always requires verification; changing policy is enforced during session restoration.
- POST /auth/register returns 201 with verificationRequired:false or verification-required 202 with true. Duplicate normalized email returns 409. Public GET /auth/configuration reports the policy.
- Recovery and resend remain SMTP/token based. Missing SMTP returns a safe unavailable error; configured-but-failing recovery returns a neutral response for known/unknown addresses. Required-mode registration mail failure may leave an unverified account; resend after service restoration, never bypass verification.
- Booking ownership, formal quotation version/expiry, accepted snapshots, money, inventory, idempotency and authorized transitions are authoritative. Displayed frontend amounts never authorize collection.
- New contactPhone is stored on Booking; legacy authenticated profile phone is an allowed fallback. Initial Submitted means pending review. Preferred dates are not appointments.
- GET /customer/notifications and overview notifications derive from owned history; no new notification model, unread count or socket infrastructure.
- Mock payment intents accept paid/failed outcomes only behind existing local non-production provider gates. No endpoint arbitrarily marks a transaction paid. Full/deposit/balance amounts use integer minor units, and administrator completion gates the balance.
- Simulated receipts use server transaction references. Failed order retries reuse the order without another stock deduction.
- New conversation routes are retired with authenticated 410 responses. WhatsApp uses the business-approved number and privacy-safe reference-only messages. Formal offers/acceptance/payments stay in Ijobisco.
- New conversation-purpose uploads are rejected; private historical media authorization remains. Cloudinary upload errors return safe 503 without credential details or false confirmation.
- Administrator mutations require role authorization and expectedRevision; formal quotation issuance also requires expectedVersion. Paid cancellation/refunds need a separate authorized reconciliation workflow.
- No employee-management or real Wave/APS payment APIs were introduced.

## Operational boundaries

Workspaces are metadata aggregates, not scalable cursor interfaces. Products are bounded to 100 per request. Private image redirects are short-lived bearer URLs. The rate limiter is single-process. Production needs HTTPS/proxy review, shared rate limiting, backups/retention, credential rotation, real SMTP/Cloudinary validation and any future verified merchant/reconciliation implementation. Do not deploy based solely on local tests.
# Cleaning-only frontend update

`POST /api/bookings` also accepts an omitted/empty `propertyType`, defaulting to an empty string. Existing House/Apartment/Office/Other values remain accepted. The cleaning-service dropdown remains required; it does not imply a property type.

The public frontend is now cleaning-services only. Historical commerce records/APIs remain intact. `POST /api/bookings` accepts empty `rooms` and `date` strings; supplied nonempty values remain validated. No schedule is confirmed by submission. `GET /api/business` uses owner-approved `+2205393273` when the administrator's WhatsApp setting is blank; a valid configured number overrides it. No database migration is required.

