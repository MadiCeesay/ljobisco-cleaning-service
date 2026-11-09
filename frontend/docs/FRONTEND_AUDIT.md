# Phase 7 — Frontend audit and integration readiness

Review date: 7 November 2026. The existing React/Vite architecture, official logo and approved page layouts are retained. This is a **frontend/UI and adapter audit**, not evidence that production authentication, notifications, payments, uploads or a backend are operational. Nothing is deployed.

## Completed feature inventory

| Area | Implemented frontend | Operational boundary |
| --- | --- | --- |
| Homepage | Approved hero, service cards, Why Ijobisco, six-step process, shop introduction, CTA/footer | Owner imagery/local assets; no fictional ratings or business statistics |
| Public pages | Four service listings/details, about, validated contact form, client 404 | Contact explicitly unavailable; service scope still subject to business confirmation |
| Storefront | Search, categories, sort, product cards/gallery, stock-aware quantity, empty states | Approved live inventory absent; demo inventory opt-in and development-only |
| Cart/checkout | Add/remove/change quantities, identifier-only restoration, review, delivery/pickup validation, explicit mock confirmation | Real totals/fulfilment/payment providers unconnected; no invented fees or pickup location |
| Account | Registration, login, recovery/reset, email verification, password toggles, labels/errors/loading | Cookie/CSRF adapters prepared; no secure production account service yet |
| Customer dashboard | Overview, bookings/details, quotations, messages, payments, orders/details, profile | Protected UI with explicit in-memory development preview |
| Cleaning request | Five steps, validation, previous/next, session draft, bounded images/previews/removal, review/submission state | No automatic pricing or guaranteed preferred appointment; real uploads absent |
| Quotations | Itemization, GMD total, issue/expiry/status, numbered history, confirm accept/decline, revision review | Formal service response only; chat cannot accept; backend must authorize every transition |
| Conversations | Booking inbox, identity, bubbles/time, text composer, attachments, read/typing/unread UI and quote cards | Local demo messaging; production subscriptions/signed uploads not connected |
| Cleaning payments | Configurable deposit/full preview, paid/outstanding summary/history, balance completion gate, statuses | Asynchronous mock outcomes only; Wave/APS disabled; no card collection |
| Administrator | Separate responsive shell, overview, search/filter tables, bookings/photos/history/schedule, quote editor, conversations, catalogue CRUD, orders, customers, payments and settings | Demo records are explicit; real RBAC, persistence, audits and uploads require backend |

## Working route inventory

Routes exist as UI routes; a data-dependent page may correctly show empty/unavailable/not-found when no matching record exists. Protected routes redirect guests and reject the wrong role.

### Public

- `/`
- `/services`
- `/services/:slug`: `home-cleaning`, `office-cleaning`, `deep-cleaning`, `post-construction-cleaning`
- `/about`, `/contact`
- `/shop`, `/shop/:slug`, `/cart`, `/checkout`
- `/register`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/request-quote` redirects to `/bookings/new` and preserves service query information.
- `/privacy`, `/terms`: clearly handled pending-business-approval pages, **not finalized policies**.
- Unmatched paths: professional client-side 404.

Development shop preview: `/shop?demo=1`; example detail `/shop/demo-spray-bottle?demo=1`. Production ignores that flag and does not expose live products or a mock checkout. Checkout is a public review route, but simulated placement requires explicit development customer access; live placement is blocked.

### Customer role

- `/bookings/new`
- `/dashboard`
- `/dashboard/bookings`, `/dashboard/bookings/:id`
- `/dashboard/quotations`, `/dashboard/quotations/:id`
- `/dashboard/messages`, `/dashboard/messages/:bookingId`
- `/dashboard/payments`, optionally `?quotation=:id`
- `/dashboard/orders`, `/dashboard/orders/:id`
- `/dashboard/profile`

Example development records: booking `demo-review`, quotation `demo-quote-v2`. New requests/orders receive local generated identifiers; those records disappear on refresh/logout.

### Administrator role

- `/admin/login`
- `/admin`
- `/admin/bookings`, `/admin/bookings/:id`
- `/admin/quotations`, `/admin/quotations/:id`
- `/admin/messages`, `/admin/messages/:bookingId`
- `/admin/services`, `/admin/products`
- `/admin/orders`, `/admin/orders/:id`
- `/admin/customers`, `/admin/customers/:id`
- `/admin/payments`, `/admin/settings`

Administrator access has no public registration path. The development entry button is visibly labelled, separate from the real administrator login and absent from production builds.

## Concrete issues resolved

1. Removed the unused Phase 3 `DashboardEmptyPage`/placeholder data and obsolete old-admin-navigation CSS. Existing domain-specific booking/quotation/payment badges remain distinct because their status rules differ; they are not duplicate generic components.
2. Reused `ServiceCard` for the homepage and services page through explicit variants, retaining their original heading levels, links, photographs and layouts.
3. Replaced a stale service-detail claim that the already-built request form was “coming in the next phase.”
4. Corrected muted text contrast on light panels and administrator tables/metadata. The initial axe baseline had 18 grouped color-contrast findings across pages; subsequent transient-loading text was also corrected.
5. Measured a conservative hero paragraph background contrast as low as 3.14:1 on desktop, excluding shadow; a mobile-specific override was also below 4.5:1. The overlay now consistently inherits 58% dark navy. The photograph, positioning, centered headline, buttons and rounded layout are unchanged.
6. Raised the skip-link above admin navigation and made its main/hash targets focusable; route navigation now moves keyboard focus to the content target. Reduced-motion rules consistently disable animations/transitions.
7. Validated API-base configuration, centralized endpoint names, separated account/profile actions from booking/upload actions and added a testable cookie/CSRF HTTP transport. Unexpected HTML/JSON, timeout, unauthorized and revision-conflict responses no longer look like confirmations. No mutation is automatically replayed.
8. Whitelisted session/profile fields, rejected profile identity/role changes, handled live-session expiry and prevented late session bootstrap/login results from overwriting a newer session. Reset also cancels pending demo customer mutations before they can repopulate a new session; a regression test covers this. No localStorage authentication was added.
9. Revalidated booking/message input at service boundaries, hardened image URL handling and ensured information requests can open a private conversation **before the first quotation** for a new booking. That scenario is covered in unit and browser tests.
10. Checkout now consumes only submitted quantities, retaining unrelated/newly added cart quantities. Live payment records are no longer unconditionally labelled simulated.
11. Replaced stock-sized product quantity option generation (potentially one million DOM options) with a stock-validated numeric input using the same form styling. Browser coverage verifies large stock and fractional-quantity rejection.
12. Checked direct dependency usage and removed three extraneous installed packages. No framework/state-management replacement or new production dependency was introduced. Optional browser-audit tools live outside the application dependency graph.

## Folder and dependency review

```text
frontend/
  src/components/           Shared catalogue cards
  src/data/                 Approved service data and isolated product fixtures
  src/features/customer/   Account, dashboard, booking/draft and demo boundaries
  src/features/quotations/ Formal quote rules/editor, messages and socket contract
  src/features/payments/   Payment/checkout/order UI and mock boundary
  src/features/admin/      Admin shell, management forms, schemas and demo repository
  src/services/            API configuration/transport/endpoints, catalogue/contact
  src/store/               Zustand cart and safe persistence/checkout helpers
  src/pages/               Existing public pages/styles
  public/images/           Official logo, approved images and demo illustrations
  scripts/                 Reproducible optional browser/accessibility audits
  docs/                    Current contract/audit and historical phase notes
  .qa/                     Ignored generated reports/screenshots/optional QA tools
```

React/React DOM, Router, React Hook Form/resolvers, Zod, Zustand, Lucide, local Inter fonts, Tailwind/Vite and ESLint are all used. `npm ls --depth=0` is clean after pruning. The socket binding helper is deliberately retained as a tested integration contract, not an unused live connection. Historical phase notes are preserved; this document is the current status reference.

## Verification and scope

Executed on 7 November 2026 with Node 24.12.0 and npm 11.6.2:

- `npm.cmd run lint`: passed.
- `npm.cmd test`: 44 passed, 0 failed.
- `npm.cmd run build`: passed. Two upstream Zod comment-annotation warnings remain; no application annotation warning was found or suppressed.
- Full local Chrome browser audit: 14 grouped functional checks, 43 axe scans, 0 reported violations and no page errors. An initial rerun exposed an image-loading timing assumption in the harness; it now awaits image decoding, and the complete rerun passed.
- Production-preview audit: 2 grouped checks, 4 axe scans, 0 reported violations and no page errors. Forged stored roles were ignored; demo authentication, inventory and mock checkout stayed unavailable.
- `npm.cmd audit --json`: 0 reported vulnerabilities. `npm.cmd ls --depth=0`: clean after pruning three extraneous installed packages. No application dependency was added.
- Production JavaScript scan: no matches for the inspected demo inventory/admin/payment fixture markers.
- Conservative hero paragraph contrast measurement (brightest background pixel, excluding text shadow): 4.76:1 at 1440px, 4.85:1 at 768px, 5.21:1 at 390px and 4.85:1 at 320px. All exceeded 4.5:1 for the measured viewport/image positions.

The browser harness writes `.qa/audit-full.json` and `.qa/audit-production.json`; screenshots are also local/ignored. These results cover local UI/adapters, not a functioning backend.

Coverage distinguishes:

- **Executed UI/adapter behavior:** public links/service images; contact validation/non-delivery; registration/recovery/reset/verification and password visibility; shop search/filter/sort/gallery; cart operations/restoration; customer/admin navigation; booking validation/drafts/photos/review; clarification before quotation; old-version rejection, decline/accept dialogs/revision issuance; chat-not-acceptance; payment preview/mock outcomes; checkout delivery/pickup validation/review/confirmation; admin editing/filtering/dialogs and role denial.
- **Executed responsive/accessibility checks:** 1440, 768, 390 and 320 pixel widths, page-overflow assertions, desktop/mobile screenshots, keyboard skip-links/menus/modal dismissal, labels/error states/image alt attributes, reduced motion and axe WCAG 2 A/AA + WCAG 2.1 A/AA rule tags.
- **Not established by those tests:** actual API persistence, secure cookies/email delivery, cross-customer authorization on a server, provider settlements/refunds/webhooks, real uploads/storage ACLs, actual stock reservations, live sockets, Safari/Firefox behavior, physical-device behavior or screen-reader conformance. Automated axe success is not a complete accessibility certification; incomplete image/other checks still require manual review.

## Security review findings and boundaries

- No embedded real credentials/private-key/API-secret patterns were found in inspected application source/configuration. Fixture/test emails and sample passphrases are labelled test data, not working production credentials. Do not place secrets in `VITE_*` variables.
- The only application localStorage access is cart persistence: product IDs/quantities only. No JWT, session token, price/inventory authority, private request, payment record or customer profile is persisted there.
- Production fixture data/adapters are tree-shaken and demo controls are disabled. Generic demo illustration SVGs remain inert public assets; they are not inventory/credentials. Never expose the Vite development server as a production deployment.
- React renders entered descriptions/messages as text. No application `dangerouslySetInnerHTML`, `innerHTML` or `eval` paths were found. Internal identifiers are URL encoded and auth redirects stay within approved customer routes.
- File MIME/size and URL checks are browser convenience, not proof of safe uploads. Real byte/dimension/MIME inspection, storage authorization and signed uploads remain mandatory backend work. Local image/photograph URLs are revoked on reset.
- Customer/admin guards, safe profile parsing and hidden controls do not replace backend RBAC, ownership checks, authoritative transitions, exact money calculations, rate limiting, audit records or provider verification. Set/test production hosting security headers/CSP with the chosen frontend/API/asset origins before launch.

## Known limitations / launch blockers

- There is no connected/persisted backend. Demo sessions and workspace edits reset; preview role switches intentionally preserve the same in-memory scenario until refresh/logout.
- Public services remain approved static content. Administrator service edits do not publish to those pages. The live catalogue adapter and production cart mutation path are not enabled.
- Real cleaning/order payment initiation stays blocked; Wave/APS are not operational. No real checkout, delivery, pickup, refund or inventory reservation is implied by a mock success.
- Real uploads, emails, Socket.IO subscriptions/reconnects and durable audit logs are absent. Text/read/form adapters are ready to target the documented API but have not been tested against a real server.
- Workspace/detail views currently use complete aggregate arrays and local table filters. Server pagination, individual fetching, comprehensive malformed-record schema integration tests and backend field-error mapping must be agreed when connecting the API.
- Business-approved privacy/terms, verified contacts, inventory and fulfilment configuration are missing. Source originals are retained alongside optimized displayed WebP/JPEG assets; confirm rights/provenance and archive unused originals deliberately before public release rather than deleting owner assets during this audit.
- Two existing upstream Zod annotation warnings remain non-blocking build warnings; dependencies were not patched or warnings hidden.

## Backend integration requirements

Use `API_CONTRACT.md` as the implementation checklist: authentication/session/CSRF and safe user projections; booking ownership and signed upload references; aggregate/detail responses; canonical formal quotation/version transactions; private conversation authorization and future socket events; trusted service/product catalogue and settings; authoritative inventory/fees/order/payment intent calculation; signed provider webhook reconciliation and administrator audit/permission enforcement.

Contracts in that document clearly mark **wired-but-unconnected** versus **reserved/disabled** endpoints. Merely setting the API base is not sufficient to enable a production shop, uploads or payment provider. Replace isolated demos through their existing adapters, preserve approved components and execute real cross-account/role/transaction integration tests before enabling live capabilities.

## Missing business information

1. Verified business email, phone, address, official public domain, legal entity/contact wording and approved service areas.
2. Final service scopes/categories, scheduling windows/timezone/lead times and cancellation/rescheduling policies.
3. Approved live product catalogue: SKUs/names/descriptions/categories, licensed imagery, GMD prices, stock source and availability rules.
4. Approved delivery areas/eligibility/fees, pickup address/instructions/hours and any applicable owner-approved tax/fee policy.
5. Approved deposit percentage/payment terms, completion/acceptance responsibilities and cancellation/refund handling. The existing 30% is a preview default, not a newly asserted business rule.
6. Wave/APS merchant onboarding, official sandbox/live API/webhook contracts and account configuration; signing credentials belong only in backend secret storage, never frontend files.
7. Storage/email providers, domains/CORS/cookie configuration, upload/privacy/retention permissions and image/logo licensing/provenance evidence.
8. Final privacy/terms/consent text, record/photo retention requirements and a secure initial-administrator provisioning process.

## Recommended next milestone

After owner approval: implement the **Express backend foundation and an authenticated booking-to-quotation vertical slice** in a sibling `backend/` folder. Agree the database/models, cookie session/RBAC/CSRF policy and contract tests first; persist customer requests, authorized photo references, administrator clarification and numbered formal quotations/acceptance. Prove cross-customer isolation and stale-version rejection before enabling live catalogue/checkout or payment-provider work. Do not build a real payment integration until merchant contracts, business configuration and server-side idempotency/webhook handling are verified.

## Reproduce the checks locally

From `frontend`, use `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd audit` and `npm.cmd ls --depth=0` on Windows. Standard `npm` works where PowerShell execution policy permits it.

Optional browser tooling is intentionally not an application dependency:

```powershell
npm.cmd install --prefix .qa/tools --no-save --package-lock=false playwright axe-core
npm.cmd run dev -- --port 5173 --strictPort
```

In another terminal, from `frontend` (installed Google Chrome required):

```powershell
$env:AUDIT_MODE = 'full'
$env:BASE_URL = 'http://127.0.0.1:5173'
npm.cmd run test:browser
```

`QA_MODULE_ROOT` can point to another QA-only tools directory; the audit used the existing temporary tooling folder. `AUDIT_MODE=baseline` records accessibility findings without failing solely for violations. Full mode fails on functional failures, page errors or remaining automated violations. Use only local/development previews and sample information, never real customer accounts.

For production gating, first build, run `npm.cmd run preview -- --port 4173 --strictPort` in another terminal, then set `AUDIT_MODE=production` and `BASE_URL=http://127.0.0.1:4173` before `npm.cmd run test:browser`. This remains a local preview, not a deployment.

No deployment or subsequent implementation phase is authorized by this audit.
