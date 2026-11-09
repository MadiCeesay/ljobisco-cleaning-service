# Data and security boundaries

## Models

- User: name, normalized unique email, optional phone, bcrypt hash excluded by default, CUSTOMER/ADMIN, Active/Disabled, actual verified boolean and authVersion. Login eligibility under optional verification never changes verified. Public DTO exposes emailVerified, not hashes or tokens.
- Session: hashed opaque cookie identifier, CSRF nonce, user/auth-version binding, expiry/TTL. Cookie is HttpOnly and Secure in production. Policy, status, role and revocation are checked on every protected session resolution.
- AccountToken: hashed single-use verification/reset token, purpose, owner and expiry. Password reset revokes sessions. Tokens are emailed, not publicly returned.
- Booking: authenticated owner, unique reference/request key, validated contactPhone, property/location/preferences/description, private photo references, backend status/revision/history, current formal version, accepted quote, frozen deposit percentage and integer paid/reserved amounts.
- Quotation: unique booking/version, immutable descriptions/quantities/unit amounts/line amounts/total/notes/issue/expiry, formal response status and acceptance time. Old Sent versions become Superseded.
- Upload: owner, purpose, optional booking/consumed record, provider reference, safe display metadata and private flag. No trusted client URLs. Historical conversation-purpose records are retained, but new chat uploads are disabled.
- Product/Service: managed catalogue, uploaded marketing images, availability and revision. Product price is integer minor GMD and stock changes atomically. Cleaning service prices are formal quotations, not fixed catalogue prices.
- Order: owner/reference, idempotency hash, immutable product/customer/fulfilment/price snapshot, inventory reservation/expiry, paid/reserved amounts, payment and fulfilment states, revision/timeline and simulation flag.
- Payment: owner/reference/request hash, booking/quotation or order, provider/choice, integer amount, provider reference, backend outcome and simulation flag.
- Settings: validated business/contact/WhatsApp, deposit and fulfilment configuration with revisions. Contacts/fees/location are blank until supplied. Official WhatsApp is validated international format, not an invented default.
- Audit: actor, action, resource, revision and timestamps. No passwords/tokens or message bodies are logged.
- Conversation/Message: archived historical models only. No active chat endpoints, Socket.IO or new message writes.
- Notifications: computed from owned history and ledger records; no notification collection or fabricated unread state.

## Authentication policy

REQUIRE_EMAIL_VERIFICATION defaults false by explicit business decision. Registration without SMTP saves verified:false, no verification token and CUSTOMER only; login uses normal bcrypt/session/CSRF paths. ADMIN always requires verified active status and private provisioning. Enabling mandatory verification also blocks existing unverified customer sessions. Public role injection is rejected. Normalized unique email rejects duplicate accounts.

Recovery remains SMTP-based and non-enumerating. Missing configuration fails identically for all addresses; provider send failures receive neutral recovery acknowledgements. No reset bypass or public reset token exists. Email verification required-mode failure can leave a pending account; use resend, not database edits.

## Authorization, money and history

All private lookups use owner filters or ADMIN authorization. Missing cross-account records return 404; customers cannot reach administrator operations. Strict Mongoose fields and Zod request whitelists block mass assignment and client status/price/owner injection.

MongoDB replica-set transactions serialize quotation issuance/revision/acceptance, money reservations and inventory changes. Current version, expiry and formal acceptance are validated; accepted amount/deposit configuration are frozen. Balance requires administrator-confirmed completion, not elapsed appointment time. Partial/failed history never erases previously paid ledger amounts.

Order creation checks current stock/prices/fee and deducts stock once. Duplicate keys resolve existing commands; changed payloads conflict. Unpaid stock expires after 30 minutes and is released once. Paid/processing cancellation requires authorized reconciliation. Mock outcomes are possible only through configured local simulation adapters after ownership/amount validation; production refuses mock enablement. No real revenue is claimed from simulated records.

## HTTP, files and external links

Helmet, bounded JSON/multipart bodies, origin allowlists, CSRF, rate limits, safe errors and redacted request logs are retained. Logs contain timing/method/status/request ID, not URLs, query tokens, bodies, cookies or provider secrets. Frontend stores only cart identifiers/quantities locally; customer drafts are memory-only.

Image uploads validate actual JPEG/PNG/WebP bytes, size, dimensions and animation, strip metadata and reencode WebP. PDFs/SVG and arbitrary remote fetching are unsupported. Owner/purpose/consumption checks bind photos to bookings. Private reads require authorization and generate short-lived authenticated provider redirects. Cloudinary configuration/failure never means upload confirmation.

WhatsApp links are explicit external actions with no-referrer/noopener/noreferrer. Only fixed text, safe booking reference and optional quote version are prefilled. No addresses, names/emails, photos, credentials or amounts are transmitted in query text. Administrator contact requires active matching customer/open booking/valid phone; staff must determine appropriateness/consent. WhatsApp messages are not application audit records or formal acceptance.

## Release blockers

Apparent credentials previously existed in backend/.env.example. The template is sanitized and ignore rules added, but the owner must rotate affected Atlas/Cloudinary credentials and purge previously shared copies/history. Private .env was not rewritten or exposed in reports. Exact-value scanning of source/docs/build artifacts found no remaining matches for configured sensitive values outside excluded private environment files.

Local tests are not production security certification. Required: real provider validation, approved privacy/contact/retention and fulfilment data, HTTPS/cookie/proxy review, centralized limits, backup/restore, monitoring/load/penetration tests and any future merchant/webhook/refund reconciliation. No deployment is authorized.
