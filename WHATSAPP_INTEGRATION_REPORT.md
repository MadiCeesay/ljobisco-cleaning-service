# WhatsApp communication integration

## Result and scope

The existing Ijobisco React/Vite frontend and Express/Mongoose backend now use ordinary WhatsApp click-to-chat for customer–business discussions. Approved public layouts, branding, navigation structure, formal quotation editor/acceptance and payment workflows are preserved. No paid WhatsApp API, platform credentials, webhooks or deployment were introduced.

The current connected business WhatsApp configuration is blank. This is intentional: no official number was supplied or invented. The public contact page therefore displays a disabled action and configuration-required explanation.

## Changes

- Added the optional `whatsappNumber` administrator setting and public business projection. Frontend and backend normalize formatting and require explicit international +country-code format, up to 15 digits. Local numbers are never assigned a guessed country code. Blank disables the action. Existing settings receive missing defaults without a database migration.
- Added shared privacy-safe WhatsApp actions to customer booking details, customer/admin quotation details, public contact and account support pages, and administrator booking details. Prefilled text contains only fixed wording, booking reference and optional quotation version; it excludes customer names, addresses, email, photos, tokens and amounts.
- Links use `https://wa.me/<digits>?text=<encoded message>`, open externally with no-referrer/noopener/noreferrer, and do not send a message automatically. Format follows the [official WhatsApp documentation](https://faq.whatsapp.com/5913398998672934).
- Administrator contact requires a matching active customer, a recognized open booking state and a valid international customer phone number. Contact is explicit and staff are instructed to use it only when appropriate for that request. The application cannot verify WhatsApp registration or customer consent merely from a valid phone format.
- Repurposed existing `/dashboard/messages[/:bookingId]` and `/admin/messages[/:bookingId]` routes as WhatsApp support pages, preserving valid navigation without a non-functional chat interface. Removed composers, typing/read/unread indicators, socket subscriptions and chat attachment uploads. Dashboard metrics now derive bookings awaiting information, not invented WhatsApp unread counts.
- Removed the Socket.IO server/client, socket event contract, Vite socket proxy and direct/transitive Socket.IO dependencies. Updated both package lockfiles. Historical Conversation/Message models and existing database records are retained, not dropped or migrated. Compatibility `conversations` and `messages` arrays are empty; no new chat records are generated or exposed.
- Retired `/api/conversations/*` with authenticated 410 `CHAT_RETIRED` responses; anonymous requests and mutation CSRF checks remain protected. Existing private media authorization remains intact; new conversation-purpose uploads are rejected.
- Clarification requests remain backend-authorized booking updates and retain full text in booking history plus audit events. Formal quotation versions, supersession, customer acceptance/decline, accepted monetary snapshots, deposit configuration, payments, scheduling and audit remain server-authoritative. WhatsApp never changes any of them. Refresh the application to retrieve canonical updates.
- Cleaned isolated demo chat logic and unused chat styles, retained disconnected quotation/payment fixtures, and extracted administrator context so public contact controls do not pull the administrator layout into the public bundle.

## Files

New frontend files:

- `frontend/src/services/whatsapp.js`, `frontend/src/services/whatsapp.test.js`
- `frontend/src/components/WhatsAppAction.jsx`, `frontend/src/components/whatsapp.css`
- `frontend/src/features/admin/AdminContext.js`

Modified frontend files:

- `frontend/src/features/admin/AdminLayout.jsx`, `AdminPages.jsx`, `SettingsPage.jsx`, `rules.js`, `rules.test.js`, `demoAdapter.js`, `demoCatalog.js`
- `frontend/src/features/customer/AccountPages.jsx`, `DashboardPages.jsx`, `authStore.js`
- `frontend/src/features/quotations/MessagingPage.jsx`, `QuotationPages.jsx`, `useWorkspace.js`, `services.js`, `rules.js`, `rules.test.js`, `demoAdapter.js`, `quotations.css`
- `frontend/src/pages/PublicPages.jsx`, `frontend/src/services/endpoints.js`, `frontend/src/services/integration.test.js`
- `frontend/scripts/audit-browser.cjs`, `audit-workflows.cjs`, `verify-live-api.cjs`
- `frontend/vite.config.js`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/README.md`, `frontend/docs/API_CONTRACT.md`

Backend files:

- Modified `backend/src/domain.js`, `contact.js`, `admin.js`, `cleaning.js`, `routes.js`, `server.js`, `uploads.js`
- Added `backend/test/whatsapp.test.js`; retained upload security tests as `backend/test/uploads.test.js` (renamed from `messaging.test.js` after removing retired chat/socket tests)
- Updated `backend/test/admin.test.js`, `commerce.test.js`, `backend/scripts/browser-check.js`
- Updated `backend/package.json`, `backend/package-lock.json`, `backend/README.md`, `backend/docs/API.md`, `MODELS_SECURITY.md`, `READINESS.md`, `FINAL_REPORT.md`

Removed source: `frontend/src/services/liveSocket.js`, `frontend/src/features/quotations/socketContract.js`, `backend/src/messaging.js`. Historical root `INTEGRATION_REPORT.md` and earlier backend reports are marked superseded for communication architecture.

## Verification

Executed checks (not backend-dependent placeholders):

| Check | Result |
| --- | --- |
| Frontend lint | Passed |
| Frontend automated tests | 48 passed |
| Frontend production build | Passed; two existing upstream Zod annotation warnings |
| Backend lint | Passed |
| Backend automated tests | 14 passed against disposable MongoDB replica sets |
| Backend syntax build | Passed; Node runs ES-module source directly |
| Authenticated frontend → Express → MongoDB browser integration | Nine workflow groups passed using an isolated database and securely provisioned disposable administrator |
| Full disconnected browser regression | 14 groups passed; 43 accessibility scans, zero reported violation groups |
| Responsive checks | Desktop/tablet/mobile at 1440, 768, 390 and 320 pixels; connected support/quotation pages included |
| Existing local server/database verification | Read-only browser proof passed through the shared Axios client and Vite proxy; `/ready` 200 `{"status":"ready"}`; public services/products/business settings/session read successfully; missing WhatsApp number correctly disabled |

The isolated browser workflow exercised registration, captured-test-email verification, login and cookie restoration, persisted profile and booking/photo data, administrator settings, WhatsApp configuration/links, administrator contact, quotation revisions and formal acceptance, 30% deposit with 70% outstanding, catalogue/cart/checkout/order persistence, cross-customer isolation, role guards and logout. WhatsApp URL inspection did not navigate to WhatsApp or send any message. SMTP/Cloudinary were injected test adapters; all payments were explicitly simulated.

Automated number-validation/privacy tests cover malformed/local numbers, safe encoding/host, rejection of unsafe references, private-data exclusion, administrator contact eligibility, setting authorization/CSRF/revision conflicts, retired chat, preserved quotation invariants and booking audit/history. Existing upload, authentication, ownership and financial tests remain in the suite.

Machine-readable browser results: `backend/.reports/isolated-browser.json`, `frontend/.qa/audit-full.json`, `frontend/.qa/live-api-readonly.json`. These local artifacts contain test scope, not proof of authenticated Atlas workflows. The live browser verification blocks non-GET API requests and made no API writes.

An initial retired-endpoint test reference and an ambiguous two-button browser selector failed during development and were corrected before final verification. An initial sandboxed esbuild invocation could not resolve its configuration; the local build succeeded with normal filesystem access. No failure was hidden or counted as passing.

Commands: run `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` inside each application directory. Browser tools use `QA_MODULE_ROOT` pointing to the installed local Playwright/axe tooling; run `node scripts/browser-check.js` inside backend, and `node scripts/run-offline-audit.cjs` / `node scripts/verify-live-api.cjs` inside frontend.

## Local review and required configuration

1. Keep the existing backend on `http://127.0.0.1:4000` and frontend on `http://127.0.0.1:5173`; frontend `VITE_API_BASE_URL=/api` uses the existing same-origin proxy. Restart local development servers if needed after dependency removal.
2. Review `/contact` for the current disabled WhatsApp state. Authenticated customers can review booking/quotation details and `/dashboard/messages`; administrators can review `/admin/messages` and `/admin/settings`.
3. An authorized administrator must enter the actual approved business number under **Settings → Official WhatsApp number**, using +country-code format, review and confirm the change. Test that number manually with the official business WhatsApp account. Leave blank until verified. Do not put credentials or numbers into chat or seed a fictional business number.
4. Refresh the customer page after changing settings. Review the prefilled message before sending. Avoid sensitive information and use Ijobisco's formal quotation/acceptance/payment controls for all official decisions.
5. For Atlas development account setup, follow `backend/docs/MANUAL_TEST_ACCOUNTS.md`: configure a development SMTP sandbox, register and verify a customer, and use the private administrator provisioning CLI. Never use public registration for an administrator, production credentials or a database-edit verification bypass.

Authenticated writes against the owner's Atlas development database remain unverified because verified Atlas test accounts were not provided. All mutation tests used disposable databases, not existing Atlas data. Official number ownership/WhatsApp enrollment, message delivery, real SMTP, real Cloudinary and real payment providers are not claimed verified. Wave/APS remain disabled; no real payment details are collected. WhatsApp conversations are external, not synced, monitored or automatically audited by Ijobisco. No deployment or subsequent phase was started.
