# Ijobisco frontend/backend integration

> Historical integration report: active Socket.IO communication has since been replaced by WhatsApp click-to-chat. Current implementation, verification and configuration are documented in `WHATSAPP_INTEGRATION_REPORT.md`. Earlier socket test results below are historical, not an active API contract.

## Scope and data-safety boundary

The existing React/Vite feature architecture, layouts, official branding and navigation are preserved. The shared frontend transport now uses Axios; it reaches the existing port 4000 Express backend through Vite's same-origin `/api` proxy. Cookie/CSRF/session-generation logic remains centralized rather than duplicated across pages. Socket.IO uses the same authorized backend and WebSocket proxy.

The owner has no verified customer/admin Atlas test accounts and explicitly requested disposable testing. Therefore:

- Existing port 4000 backend/MongoDB checks are **read-only**. No automated registration, CSRF session creation, fixture seeding, metadata mutation, payment or deletion was performed against Atlas.
- Full authenticated workflows run on randomly assigned local API/frontend ports with a disposable MongoDB replica set. Test configuration does not load `backend/.env` or its database/provider credentials. Administrators are created through the same validated provisioning function used by the private CLI, not a public role bypass.
- SMTP/Cloudinary are explicit injected test transports only in isolated tests. Server mock payments use no real money and remain disabled in the connected owner's configuration. No deployment occurred.

## Changes

1. Added a lazy-loaded Axios fetch-adapter bridge underneath the existing domain APIs, with credentials enabled, bounded abortable requests, no redirect following, strict JSON handling and no mutation replay. CSRF is fetched from the backend and held in memory; no JWT/session token is stored in localStorage.
2. Added client-owned, code-specific messages for missing SMTP, image storage, payment providers, business fulfilment and unsupported email changes. Raw arbitrary server messages are not reflected into the UI.
3. Disabled fixture accounts, catalogue controls and demo adapters whenever a real API base is configured. Disconnected development previews remain explicitly separate; production guards still remove/disable fixtures. Cart keys and identifier formats separate fixture/live inventory.
4. Retained the existing real account, booking, quotation, administrator, catalogue/cart/checkout/order/payment-history adapters and verified their behavior instead of rebuilding them.
5. Corrected the browser Socket.IO handshake to use WebSocket transport. Same-origin polling did not provide the Origin required by the strict server handshake policy. No origin/CSRF/membership check was relaxed. Connection state now distinguishes connected, reconnecting and unavailable, and survives workspace refreshes.
6. Shared secure administrator provisioning between the CLI and disposable test setup, preserving strong bootstrap passwords, customer-only public registration and refusal to overwrite/promote existing accounts.
7. Added read-only live browser verification, expanded isolated browser checks, Axios regression tests and an isolated offline UI/accessibility audit runner. Temporary test servers never replace the owner's port 4000 service.

## Adapter inventory

| Development implementation | Connected equivalent | Boundary |
| --- | --- | --- |
| customer/demoAdapter, demoBookings | authService/authStore, `/auth/*`, `/customer/profile`, `/customer/overview`, `/bookings` | SMTP required for new verified customer accounts; cookies/CSRF/RBAC enforced |
| quotations/demoAdapter | customer/admin quotation workspaces, formal issue/response endpoints | Backend controls amounts/current versions/acceptance, never chat |
| local demo messages/events | private conversation APIs plus authenticated Socket.IO | Participant ownership, private history/read state and reconnect refresh |
| demoCatalog/demoProducts | `/services`, `/products`, admin catalogue operations | Approved static service fallback retained; no fake live inventory |
| demo cart references | live ID/quantity-only cart persistence plus canonical checkout preview | Browser prices/stock never authoritative |
| payments/demoAdapter | checkout configuration/preview, `/orders`, `/payments/*`, combined payment/order history | Live Wave/APS disabled; server mock only in isolated local tests |
| admin/demoAdapter | `/admin/workspace`, revision-checked management APIs | Backend ADMIN authorization, no public administrator signup |
| local photo previews | backend-inspected multipart `/uploads` and authorized private reads | Cloudinary must actually be configured; no arbitrary image URL substitution |

## Current live connection verification

Executed through Chrome at `http://127.0.0.1:5173`: the shared Axios adapter read the real backend's services/products/session through the proxy. Direct `/ready` returned HTTP 200 `{ "status": "ready" }`, which performs a MongoDB ping. Observed public catalogue: four service entries and zero products. Guest protected-route redirects and hidden fixture controls passed. No non-GET request was attempted in that verification. Report: `frontend/.qa/live-api-readonly.json` (ignored generated artifact).

This proves frontend → real backend → configured MongoDB **read integration**, not authenticated Atlas account or provider integration. No private Atlas URI/credential was printed, copied into tests or used to seed data.

## Verification results

Executed results:

| Check | Result | Scope |
| --- | --- | --- |
| Frontend lint | Passed | Existing app plus Axios/fixture-isolation/QA changes |
| Frontend automated tests | 46 passed, 0 failed | Transport, cancellation/CSRF, forms, role/session projections, cart, quotation/payment rules |
| Frontend production build | Passed | Axios/Socket.IO lazy chunks; no chunk-warning threshold changes |
| Backend lint | Passed | Runtime, shared provisioning and test tooling |
| Backend automated tests | 14 passed, 0 failed | Disposable MongoDB replica sets, including authorization, concurrency, provisioning and unavailable-provider gates |
| Backend build | Passed | ES-module syntax build/check; Node runs source directly |
| Existing-server browser verification | 4 groups passed | Read-only frontend Axios → existing Express → configured MongoDB; no Atlas writes |
| Authenticated browser integration | 9 groups passed | Isolated real Express/Mongoose replica set with registered customer/provisioned admin and explicit provider test adapters |
| Offline UI/accessibility regression | 14 groups, 43 axe scans; 0 reported violations | Disconnected fixture preview, not Atlas or a production certification |
| Runtime dependency audits | 0 reported vulnerabilities, both apps | Executed npm audit --omit=dev |
| Production JavaScript fixture-marker scan | No matches | Fixture controls/loaders remain disabled/tree-shaken in production |

Authenticated browser coverage includes registration/verification/login, session restoration after refresh, persisted profile updates, photo-bearing booking creation/details, administrator UI issuance/revision, two-way customer/admin messages with actual Socket.IO notifications, latest-version acceptance, server-confirmed mock deposit and remaining balance, catalogue/cart/checkout/order history, customer isolation/role denial, four responsive widths and mobile-menu logout/protected redirects. This is not a claim of authenticated Atlas/provider success.

Two existing upstream Zod annotation warnings remain in the successful frontend build; no dependency warnings were hidden or patched. Early runs failed on a redirect-error representation assumption, a hardcoded dashboard heading, a hot-reload-interrupted transient feedback check and a mobile-menu selector. The harness was corrected, source edits paused, and final complete reruns passed. The browser also found a genuine Socket.IO polling/Origin incompatibility; WebSocket transport fixed it without relaxing backend security. No failed or interrupted run is counted as a pass above.

Generated evidence: frontend/.qa/live-api-readonly.json, frontend/.qa/audit-full.json, backend/.reports/isolated-browser.json. These ignored reports contain test scope/results, not production credentials. Temporary servers/databases were closed after testing; the owner's existing frontend/backend remained available.

### Files touched

- Frontend transport/config: package manifests/lockfile, .env.example, vite.config.js, src/services/apiClient.js, httpClient.js, axiosTransport.js and its tests.
- Frontend isolation/live messaging: demoMode.js, the existing customer/admin/quotation/payment/catalogue adapters, cart.js, liveSocket.js, useWorkspace.js, MessagingPage.jsx and connected-mode fixture controls in the existing account/admin/public pages.
- Verification: frontend/scripts/verify-live-api.cjs, run-offline-audit.cjs; backend/scripts/browser-check.js; backend/test/helpers.js, actors.js, provisioning.test.js and unavailable.test.js.
- Secure provisioning: backend/src/provisioning.js and the existing bootstrap-admin.js CLI now share one validated operation. No new public administrator endpoint was added.
- Documentation: current frontend API contract, integration report, backend handover pointers and secure manual-account guide. No approved page layout, brand asset or navigation route was replaced.

## Required configuration and unverified flows

- SMTP host/from are currently unconfigured. Connected registration/recovery/email verification delivery cannot complete until SMTP is configured. The application returns a clear unavailable error; verification is not bypassed.
- No verified customer/admin Atlas accounts were supplied. Atlas-specific login, restored authenticated session, profile writes, booking persistence, quotation issuance/acceptance, private messaging, checkout/order/payment-history writes and cross-account isolation are **not verified against Atlas**. They must be exercised manually with approved development accounts after setup.
- Cloudinary variables are present but actual provider credentials/storage behavior were not tested. No real provider upload was attempted during this pass. Isolated byte/purpose/ownership tests do not prove Cloudinary account configuration.
- Wave and APS remain disabled. No real charge, webhook settlement, refund or fulfilment is claimed. Existing fulfilment configuration and live inventory must be supplied/approved by the owner.
- The current UI uses complete metadata workspaces and a bounded public catalogue; larger deployments require explicit pagination/scaling work. Conversation views initially load the latest 50 messages; the backend exposes older-message pagination, but the UI has no full history-pagination controls yet. Customer email change and a resend-verification UI remain separate follow-ups.
- The strict-origin Socket.IO integration requires a functioning WebSocket upgrade proxy; HTTP-polling fallback is intentionally not enabled by weakening origin checks.

## Manual accounts and run instructions

Follow `backend/docs/MANUAL_TEST_ACCOUNTS.md` to provision a development administrator through the private CLI and register/verify customer accounts through configured SMTP. This guide never instructs editing verification/role fields directly in MongoDB.

From root: `cd backend; npm.cmd run dev` after privately configuring its `.env`; second terminal `cd frontend; npm.cmd run dev -- --port 5173 --strictPort` with `VITE_API_BASE_URL=/api`. Readiness: `Invoke-RestMethod 'http://127.0.0.1:4000/ready'`. Do not enable real payment providers or deploy until owner configuration and manual authenticated Atlas/provider review are complete.
