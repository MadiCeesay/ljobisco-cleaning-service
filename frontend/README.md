> Latest implementation and verification: repository-root `MASTER_COMPLETION_REPORT.md`. It supersedes historical mandatory-customer-verification assumptions and test counts; approved designs and WhatsApp remain intact.

> Current communication architecture: WhatsApp click-to-chat replaces the historical Socket.IO implementation described in earlier reports. See the repository-root `WHATSAPP_INTEGRATION_REPORT.md` and current API contracts. Historical chat verification below is not a claim that chat remains active.

# Ijobisco Cleaning Services — Phases 1–7

Latest real API integration: `../INTEGRATION_REPORT.md`. Axios uses the shared cookie/CSRF boundary through `/api` → backend port 4000. Connected mode disables all fixture account/inventory controls; offline fixture QA runs separately with `node scripts/run-offline-audit.cjs`. Secure manual Atlas customer/admin setup is in `../backend/docs/MANUAL_TEST_ACCOUNTS.md`. No authenticated Atlas/provider success is implied by isolated tests.

## Current backend integration

The sibling `backend/` implements the API and retains this frontend's approved layouts. See `../backend/README.md` for exact setup, environment, administrator bootstrap and tests; `../backend/docs/READINESS.md` distinguishes locally tested workflows from missing live providers/configuration. Set `VITE_API_BASE_URL=/api` in a private `.env.local`; Vite proxies API/socket traffic to port 4000. Real MongoDB, SMTP and Cloudinary configuration is still required. Wave/APS remain unavailable. Only opt-in local mock payments may be enabled; no deployment is performed. Earlier phase notes below describe historical disconnected/demo behavior, not current integration capability.

Local React/Vite public website, shopping preview and customer account experience. Nothing has been deployed. Customer accounts and cleaning requests use an explicitly development-only adapter until the backend is connected. No real messages, bookings, orders or payments are submitted by the demo.

## Phase 7 audit

Current inventory, routes, actual verification results, known limitations and missing business inputs are recorded in `docs/FRONTEND_AUDIT.md`. Request/response shapes, protected operations and the future socket contract are in `docs/API_CONTRACT.md`. Optional reproducible browser/accessibility checks live in `scripts/`; setup is documented in the audit. Earlier phase notes are historical. No backend or deployment is implied; stop for owner approval before the next milestone.

## Phase 6 review

Open `/admin/login` and explicitly choose **Open Administrator Demo** for local testing. The administrator dashboard covers requests, quotations, private conversations, services/products, orders, customers, payments and business settings. See `docs/PHASE6.md` for routes, integration contracts and limitations. Demo changes stay in memory; real authorization, uploads and payment processing require the backend. Nothing is deployed. Stop for owner review before further phases.

## Phase 5 review

Cleaning payment summaries, simulated checkout and customer order history are implemented. See `docs/PHASE5.md` for routes, configurable deposit previews, local demo instructions, verification results and backend/payment-provider limitations. No real payments or fulfilment are enabled. Stop before Phase 6 for approval.

## Run locally

```sh
cd frontend
npm install
npm run dev
```

Run these commands from the `Ijobisco-Cleaning` project root. All frontend source, assets, dependencies and build output live in this folder. A sibling `backend` folder can be added later.

On Windows PowerShell with restricted script execution, use `npm.cmd` instead of `npm`.

## Checks

```sh
npm run lint
npm run build
```

## Brand assets

The supplied master brief specifies blue `#073B91`, navy `#0B2142`, green `#087A20`, and background `#F4F8FC`. Inter is bundled locally through Fontsource.

The owner-supplied official logo is stored at `public/images/ijobisco-logo.jpeg` and displayed in the header and footer, preserving its square proportions. A labelled temporary wordmark is used only if the image cannot load.

## Photography

The reference screenshot is not used as an asset. Natural-color stock photographs are stored locally for the hero, four service cards and the distinct Why Ijobisco image. The original hero was monochrome at source; it has been replaced rather than artificially colorized. The hero uses a 45% dark navy overlay (48% on mobile) with responsive positioning to keep the cleaner visible. No staff identity or endorsement is implied.

See `ASSET-LICENSES.md` for source and licensing details.

## Phase 1 scope

Includes responsive white navigation, mobile menu with Escape support, rounded photographic hero, requested headline and calls to action, a 2×2 image-card service grid (single column on mobile), six-step booking process overview, company introduction, shop introduction, final quote call to action and footer. Browse Products leads to a clearly handled catalogue-unavailable page. No ratings, testimonials, statistics, fictional contact information, products, prices or team members are displayed.

Service categories are proposed and marked for owner confirmation. Service catalogue, contact details, products, legal policies and social links remain to be supplied. The quote route now opens the protected Phase 3 booking form and preserves the intended service through login.

Phase 4 is implemented. Stop before Phase 5 until the owner approves.

## Phase 4 review

Customer demo: log in at `/login` using the explicit development adapter, then open `/dashboard/quotations` or `/dashboard/messages`. Administrator demo: open `/admin/login` and choose **Open Administrator Demo**. Public registration has no administrator role. Customer sessions cannot access quotation editing controls.

The quotation workspace includes itemized service-calculated records, numbered revision history, expiry/status rendering and accept/decline confirmation dialogs. Negotiation conversations contain quotation cards, plain-text messages, local attachment metadata, timestamps, unread state and typing-event support. Chat never formally accepts an offer. Deposit/full selection is a non-operational preview, available only after valid formal acceptance; no payment is taken.

See [docs/PHASE4.md](docs/PHASE4.md) for review steps, all new routes, proposed backend APIs, role/ownership/version rules and the future Socket.IO event contract. Demo data is in memory and excluded from production. No real socket connection or attachment upload is simulated.

## Phase 3 review

Open `/login`, enable **Use development demo adapter**, and enter a sample email and password to preview the protected dashboard and `/bookings/new`. All five account forms, the customer dashboard routes, profile editing and the five-step request flow are implemented. The demo session and booking drafts stay in memory; refreshing or logging out clears them. No passwords, authentication tokens, customer data or photographs are persisted to browser storage.

See [docs/PHASE3.md](docs/PHASE3.md) for routes, file organization, the future cookie/CSRF API contract, Cloudinary upload boundary and limitations. Demo customer fixtures are excluded from production. Real authentication, email and photo uploads require backend integration. Quotation negotiation, formal acceptance, payment processing and order workflows remain later-phase work.

## Phase 2 pages

- `/services`: responsive service cards using the owner-supplied images, with Learn More and quotation links.
- `/services/:slug`: structured detail pages for `home-cleaning`, `office-cleaning`, `deep-cleaning`, and `post-construction-cleaning`.
- `/about`: company introduction, mission, values and quotation call to action.
- `/contact`: React Hook Form and Zod validation. Loading, local validation success, unavailable and error states. No message is transmitted or saved.
- `/shop`: search, category filtering, sorting and a live-catalogue empty state.
- `/shop/:slug`: product illustrations, gallery, fixed demo price, stock and quantity controls.
- `/cart`: Zustand cart state, stock-bounded quantities, removal, displayed subtotal and checkout-unavailable link.
- Unknown routes, service slugs and product slugs: handled 404 page.

### Trying the shopping interface

Start `npm.cmd run dev` from `frontend`, open `http://127.0.0.1:5173/shop`, and choose **Preview Demo Products**. Alternatively visit `/shop?demo=1`. Every sample product, price and stock value is clearly labelled as demo content. Product links include the demo flag. Illustrations are local SVGs created for this preview; they do not represent real Ijobisco products.

The fixture adapter dynamically loads `src/data/demoProducts.js` only in Vite development mode. Production builds always use the empty catalogue and do not bundle the sample inventory. Cart references survive refresh through local storage; only product identifiers and quantities are stored, never prices, stock, product snapshots or customer information. Restored items are resolved against the current catalogue, quantities are capped to current stock, and missing or out-of-stock products are discarded. Malformed or inaccessible storage falls back safely to an empty or in-memory cart. No checkout, delivery charge, pickup location or payment provider is configured.

Development and production use separate versioned storage keys (`ijobisco:cart:demo:v1` and `ijobisco:cart:live:v1`). Persisted demo identifiers cannot populate the production cart: its live catalogue is empty. Cart controls wait for restoration before accepting additions. Prices and stock still require server validation before any future real checkout.

### Phase 2 files

Created:
- `src/data/services.js`: shared structured service descriptions and requirements.
- `src/data/demoProducts.js`: isolated development-only sample inventory.
- `src/services/catalog.js`: catalogue adapter and GMD formatting.
- `src/services/contact.js`: unavailable contact submission adapter.
- `src/store/cart.js`: cart state and stock constraints.
- `src/components/ServiceCard.jsx`, `src/components/ProductCard.jsx`: reusable cards.
- `src/pages/PublicPages.jsx`, `src/pages/public-pages.css`: public pages and responsive styles.
- `public/images/demo/spray.svg`, `cloths.svg`, `brush.svg`, `supplies.svg`: original demo illustrations.

Modified:
- `src/main.jsx`: Phase 2 routing, navigation destinations, shared service data and cart count.
- `package.json`, `package-lock.json`: React Hook Form, Zod, resolver and Zustand dependencies.
- `eslint.config.js`: exclude local QA artifacts.
- `README.md`: Phase 2 usage and limitations.

### Remaining business information

Approved product catalogue, verified contact details, final service scope, legal policies and confirmed operational mission/values are still needed before public launch. Mission and values copy expresses the proposed approach, without invented history, certification, staff or achievements. Real catalogue, contact and checkout services need backend integration. Client-side cart values and validation are not authoritative for real orders.

### Phase 2 verification

- ESLint and production build pass. The build reports two non-blocking annotation warnings from the installed Zod dependency; Rollup removes those comments and completes successfully.
- Browser checks pass for page navigation, all four service details, handled 404 routes, product search/category/sort, no-match and catalogue-empty states, gallery selection and out-of-stock controls.
- Cart checks pass for card/detail additions, duplicate merging, increases/decreases, stock limits, minimum quantity, subtotal changes, removal, header count and unavailable checkout.
- Contact checks pass for required fields, invalid email, loading, successful local validation and the explicit unsent/unavailable response.
- Desktop 1440px, tablet 768px, mobile 390px and narrow mobile 320px checks pass for eight page layouts, loaded images, labelled inputs, one main heading and no horizontal overflow. Mobile navigation and Escape behavior pass. The populated cart also passes at 320px.
- Production preview confirms that `?demo=1` does not enable sample inventory and the demo switch is absent. Production JavaScript does not contain the sample product records.
- No browser runtime errors were observed. These are frontend checks, not a backend, payment or full accessibility audit.

### Phase 2 quality pass

The two annotation warnings were traced to explanatory comments in the installed Zod package: `node_modules/zod/v4/core/util.js:400` and `node_modules/zod/v4/core/regexes.js:74`. Their literal `@__PURE__` text is interpreted as misplaced annotations by Rollup. They do not originate in our application or Vite configuration. Dependency files were not patched and build warnings were not suppressed; Rollup discards those comments and builds successfully.

Cart persistence is implemented in `src/store/cart.js` and `src/store/cartPersistence.js`. Six focused tests in `src/store/cartPersistence.test.js` run with `npm.cmd test`, covering the storage whitelist, tampered fields, stock reconciliation, removed products, malformed/duplicate references, storage limits and denied access. No design changes or Phase 3 features are part of this pass.

Quality-pass results: lint, all six unit tests and production build pass (with the two upstream warnings above). Browser checks pass for reload and quantity persistence, catalogue-based prices, stock clamping, removal persistence, corrupt storage recovery, Services/Shop/Cart at 1440/768/390/320px, and production rejection of persisted demo identifiers and the demo query flag. No browser runtime errors were observed.
