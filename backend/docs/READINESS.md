# Local implementation handover

Latest integration follow-up: repository-root `INTEGRATION_REPORT.md`. It supersedes the original test counts/transport notes below: Axios, WebSocket-only browser transport under strict Origin checks, connected-mode fixture isolation, 14 backend/46 frontend tests, and a separate read-only proof against the existing MongoDB-backed API. No permanent Atlas customer/admin account was inserted by tests; use `MANUAL_TEST_ACCOUNTS.md` for secure owner-run setup.

## Completed modules

All six backend implementation stages are present: Express security/configuration/database foundation; configurable customer verification and mandatory administrator authentication; owned cleaning requests and immutable formal quotation revisions; WhatsApp click-to-chat support and secure image adapter; transactional catalogue/orders/payment ledger; administrator management and React API integration. Existing blue/white/green branding, logo, navigation and page layouts were not replaced.

Real API browser integration has passed using a disposable MongoDB replica set: registration, verification, login, photo-bearing request, revised formal offer acceptance, 30% server mock deposit, live-catalogue/cart/checkout/order confirmation, and overflow checks at 1440/768/390/320px. SMTP and Cloudinary in that test are explicitly injected boundaries, not evidence of real provider delivery/storage. A separate complete frontend demo audit passed 14 grouped checks/43 axe scans with no reported violations. The initial browser attempt hit an existing preview on a fixed port; the harness now chooses its own free port and the complete rerun passed.

Backend integration suite: final rerun after the security dependency updates passed all 12 grouped tests, including the complete requested registered-customer/photo/negotiation/revision/acceptance/deposit/remaining-balance scenario and a separate inventory/order/mock-payment/fulfilment scenario. Backend lint and ES-module syntax build passed. Frontend suite: 44 tests passed; lint and production build passed (two existing upstream Zod annotation warnings). Socket.IO client is dynamically loaded; no chunk-warning threshold was increased to hide warnings. Production dependency audits reported zero vulnerabilities for both applications. The only checked backend environment file is the secret-free `.env.example`; high-confidence private-key/cloud-credential patterns were absent from inspected source/scripts.

Dependency security audit initially identified vulnerable Nodemailer and sharp versions. Upgraded to reported patched versions (Nodemailer 10.3.1, sharp 0.35.5); subsequent full backend npm audit reported zero vulnerabilities. This is dependency metadata, not a penetration-test certification. No real credential or administrator password is included in source; fixture accounts/product values are created only in disposable integration databases.

## What is not operational yet

1. Owner MongoDB/Atlas connection: the owner confirmed no permanent database exists yet. Add your own URI in `backend/.env`; the test database is deliberately disposable and not an application datastore.
2. Real SMTP: credentials/from domain and deliverability verification are missing. Registration/recovery/contact fail safely until configured. Resend verification is available after fixing a failed delivery. No actual email delivery was tested.
3. Real Cloudinary: account/API credentials/access settings are missing. Bytes, ownership and access-control rules are tested with an injected adapter; actual upload, private signed delivery and deletion/retention must be verified with your account. PDF uploads are unsupported; image-only validation is deliberate.
4. Wave/APS: disabled adapters only. No verified merchant API credentials/documentation/webhook contract was provided. No real payment, refund, reconciliation or card collection is implemented or claimed.
5. Business configuration: verified contacts, service areas, real product catalogue/images/prices/stock, delivery fee/eligibility, pickup location/instructions, legal/retention/refund policies and operational schedule rules remain owner inputs. Empty/disabled states are intentional, not missing fabricated data.

## Known implementation boundaries

- Same-origin `/api` proxy is the documented complete frontend integration path, including private image links. Absolute cross-origin JSON API bases are transport-supported, but relative image links need the same-origin proxy or a deliberate asset-URL integration change.
- Existing workspace UI consumes full metadata aggregates; large datasets require explicit server/UI pagination rather than silently truncating booking/quote/admin collections. Public product listing is capped at 100; current frontend filters that loaded catalogue. WhatsApp conversations are external and are not retained or monitored by this application.
- Customer email changes are blocked pending a separately verified-email-change workflow. Names and phone updates work. Customer account disable/enable API is implemented; existing customer detail UI is informational, not a new status editor.
- Catalogue disable is supported; destructive deletion of referenced products/services is intentionally not exposed. Category labels are product-managed strings, not a separate category-administration collection.
- Current production payment boundaries fail closed. Connected checkout may create an unpaid order after approved fulfilment configuration, but no payment success is implied. Backend development mock settlement persists labelled simulated records; the older explicit frontend demo remains isolated and memory-only.
- Payment Processing after a crash requires same-key retry/reconciliation; no manual paid switch exists. Real durable provider reconciliation/refunds are blocked until merchant integration. Paid cancellation is not silently treated as a refund.
- Single-process in-memory rate limiter infrastructure, aggregate reads and minute reservation sweeps need operational load/scaling review. Production proxy trust must be explicitly configured for your topology; forwarded IP headers are not trusted by default.
- API tests/Chrome checks are not Safari/Firefox/mobile-device/screen-reader or production HTTPS/cookie/provider tests. No production-readiness certification or deployment has been performed.

## Required release checklist

- [ ] Owner-managed development/production databases, least-privileged users, replica-set transactions, index rollout and tested backup/restore.
- [ ] HTTPS frontend/API reverse proxy and Socket.IO upgrade routing, exact allowed origins, secure-cookie/SameSite tests, trusted-proxy/rate-limit configuration.
- [ ] Private interactive administrator bootstrap; strong temporary password rotation, account lifecycle and privileged access review.
- [ ] Real SMTP sandbox/live domain verification, token links, neutral recovery/resend behavior and abuse monitoring.
- [ ] Real Cloudinary image upload, owner denial, authenticated storage/signed-read expiry, quotas and approved retention/orphan cleanup policy.
- [ ] Owner-approved contacts/service/stock/fees/pickup/legal settings; no test products/locations copied into live data.
- [ ] Verified merchant onboarding/docs/currency/webhooks/idempotency/reconciliation/refunds before enabling any live provider.
- [ ] Shared scalable limiter infrastructure if multi-instance, monitoring/audit retention, failed-intent alerts and load/DoS testing.
- [ ] Independent authorization/file/payment security review, real cross-account provider tests and browser/device accessibility review.
- [ ] Final business approval. Deployment is a separate explicit authorization.

## Exact local commands

From the project root, first configure privately (do not overwrite an existing `.env`):

```powershell
cd backend
npm.cmd ci
Copy-Item .env.example .env
# Edit .env: your MongoDB replica-set URI, SMTP and Cloudinary settings.
npm.cmd run bootstrap-admin
npm.cmd run dev
```

In a second terminal from the root:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env.local
# Set VITE_API_BASE_URL=/api; leave VITE_LOCAL_MOCK_PAYMENTS=false normally.
npm.cmd run dev -- --port 5173 --strictPort
```

Open `http://127.0.0.1:5173`. Health/readiness: `http://127.0.0.1:4000/health`, `/ready`. The backend will not start against an unavailable placeholder MongoDB URI. No permanent backend is left running against a test datastore.

Backend checks: `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd audit`. Frontend checks: same commands from `frontend`. Optional real-API browser harness: from `backend`, set `QA_MODULE_ROOT` to the QA-only directory containing Playwright, then `node scripts/browser-check.js`; requires installed Chrome and free backend port 4000. It creates/stops temporary Vite/API/database processes and never reads your `.env` credentials or seeds your real database.

## Latest local completion pass

See root `MASTER_COMPLETION_REPORT.md` for current feature inventory, executed tests and limits. Signup defaults to optional verification; SMTP recovery remains secure and separate. Keep private credentials out of templates and rotate the apparent Atlas/Cloudinary credentials previously present in `.env.example`. Templates are now sanitized. Existing Atlas data was not modified by this pass; authenticated Atlas workflows remain owner-run checks.
