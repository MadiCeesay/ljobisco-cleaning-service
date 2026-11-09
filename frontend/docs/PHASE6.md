# Phase 6 — Administrator dashboard

## Local review

From `frontend`, run `npm.cmd run dev`, then open `/admin/login`. The **Open Administrator Demo** button is explicitly development-only and appears only in development builds. It does not create an account or authenticate against a production backend.

The separate administrator shell includes the official logo, responsive sidebar/mobile menu, top navigation, page search, refresh action, environment labels and role-aware routing. Approved public-page designs are unchanged.

### Available routes

- `/admin`: overview derived from current adapter records; no fabricated live statistics.
- `/admin/bookings` and `/admin/bookings/:id`: searchable/filterable requests, property details, photographs, private information requests, scheduling/progress confirmations and history.
- `/admin/quotations` and `/admin/quotations/:id`: existing formal editor, initial/revised offers, itemization, version history and status filters.
- `/admin/messages` and `/admin/messages/:bookingId`: existing private inbox with customer identity, references, unread counts, replies and related formal quotations.
- `/admin/services`: add/edit service information, manage local images and enable/disable managed entries.
- `/admin/products`: add/edit products, category, fixed GMD price, integer stock, images and availability.
- `/admin/orders` and `/admin/orders/:id`: fulfilment filters, checkout contact/address details, recorded payment information and confirmed fulfilment history.
- `/admin/customers` and `/admin/customers/:id`: account status, approved contact fields and booking/order history. No credential fields are displayed or editable.
- `/admin/payments`: payment references, related requests/orders, customer, method, amount/status and outstanding cleaning balances. Read-only; no manual paid/refund controls.
- `/admin/settings`: company identity, optional approved contact details, service areas, deposit percentage, explicit delivery fee/areas and approved pickup configuration.

## Connected development scenario

1. Review a booking, request photographs/clarification and inspect its private conversation. An on-site inspection is not required for every quotation.
2. Manage fixture products and settings. To test pickup fulfilment, enter an explicitly sample pickup location and enable pickup in the demo. Blank configuration is never treated as an approved location or free delivery.
3. Use **Switch to Customer Preview** without logging out. Accept the latest quotation and make a simulated deposit. The configurable percentage is reflected by both the demo payment summary and mock payment adapter.
4. Use the customer demo banner's **Open Administrator Preview**, then explicitly open the administrator demo again. The same in-memory records remain available across these role-preview switches.
5. Confirm scheduling only after accepted quotation and confirmed payment; progress Scheduled → In Progress → Completed through confirmation dialogs. The adapter confirms each change. The customer cannot confirm completion.
6. Switch back to the customer preview and pay the remaining balance only after that adapter-confirmed completion.
7. Create a simulated product checkout, then return to the administrator preview to review its private fulfilment details and update its timeline. Fulfilment progress requires confirmed payment and relevant configuration. Cancelling fulfilment never implies a refund.

Browser refresh/logout resets demo records. No demo customer, administrator or business data is stored in local storage. Existing cart persistence remains product identifiers/quantities only. Photo/image object URLs are local previews, never uploads, and are revoked on reset. JPG/PNG/WebP images are limited to 5 MB each; managed catalogue galleries contain one to four images. Customer photographs retain their original eight-photo limit.

## Data boundaries and limitations

- All fixture repositories are development-only imports. Counts derive from their current records, including existing quotation/payment/checkout adapters. Orders and payment tables start empty until those adapters create records. Low stock is explicitly defined as enabled products with three or fewer units.
- Managed product edits affect the development catalogue and mock checkout. Changed/disabled/out-of-stock products are revalidated by the mock order adapter; stale cart revisions require review. No actual inventory reservation occurs.
- Managed service edits are demonstrated in the administrator catalogue. Approved public services pages remain on their existing structured content until a backend-managed public catalogue is supplied; this phase does not publish content changes.
- Settings remain development configuration, not verified live business contact information. The real checkout remains gated pending backend fulfilment totals and payment-provider integration. Enter sample personal/contact/location data only in demos.
- Booking and fulfilment mutations check expected revisions and allowed transitions. Concurrent booking changes are rejected. Administrator dialogs wait for a refreshed workspace before closing so old table data is not presented as a completed update.
- Local customer photo previews can be reviewed by the administrator without pretending they were uploaded. Real photo/catalogue uploads require backend-signed storage integration; live catalogue saves containing new files fail before sending changes.
- Tables use frontend search/filtering and horizontal scrolling on narrow screens. Server pagination, durable audit records, actual notifications, live Socket.IO, real uploads and payment processing require backend integration.

## Backend authorization contract

Existing cookie/CSRF API transport is reused. Frontend guards and hidden controls are not a security boundary. Every endpoint must validate an authenticated administrator session, permissions, ownership where relevant, schema, state transition and expected revision. No public administrator registration or localStorage JWT strategy is added.

| Operation | Prepared endpoint |
| --- | --- |
| Read workspace | `GET /admin/workspace` |
| Save settings | `POST /admin/settings` |
| Add/edit service | `POST /admin/services` / `POST /admin/services/:id` |
| Add/edit product | `POST /admin/products` / `POST /admin/products/:id` |
| Request clarification | `POST /admin/bookings/:id/information-requests` |
| Update schedule/progress | `POST /admin/bookings/:id/schedule` |
| Update fulfilment | `POST /admin/orders/:id/fulfilment` |

The workspace response contains `bookings`, `quotes`, `conversations`, `services`, `products`, `customers`, `orders`, `payments`, `balances`, `settings` and `settingsRevision`. Catalogue/booking/order records carry a `revision`. Customer records must be server-side safe projections (`id`, `name`, `email`, `phone`, `status`) with no passwords, reset tokens, session secrets or internal credentials. Mutation requests include `expectedRevision`; confirmed live mutations return `{ record: { revision, ...canonicalFields } }`.

The backend must also implement atomic transitions, idempotency/auditing, signed upload validation, authoritative money/inventory/configuration calculations and payment-provider confirmation. A frontend scheduling update cannot prove real cleaning completion; only an authorized backend workflow can do so. Existing quotation and messaging contracts remain documented in `PHASE4.md`; payment boundaries are in `PHASE5.md`.

## Recorded verification

- Lint passed; all 34 automated tests passed; production build passed. The two previously investigated upstream Zod annotation warnings remain non-blocking.
- Tests cover catalogue/settings/image validation, table filters, role denial, revision conflicts, clarification history, payment/configuration-dependent transitions, local photo preview cleanup, logout cancellation and cancelled-booking quotation rejection.
- Browser checks passed for sidebar navigation, search, filters, add/edit/availability forms, image selection and validation, confirmation cancellation/acceptance, conversations, quotation filters, customer details, empty states, orders and payment tables.
- The connected customer–administrator scenario passed: configured deposit, accepted quotation, simulated payment/order, administrator scheduling and order updates, history and completion-gated balance payment. Customer access was denied across every administrator section.
- Overview, management tables, settings, conversations and order details passed layout checks at 1440, 768, 390 and 320 pixels. Desktop/mobile screenshots were reviewed. A 320-pixel sidebar/dialog keyboard check passed.
- Production checks passed for protected routes, ignored forged stored roles, absent demo authentication and disconnected-login failure. Approved homepage imagery remains unchanged. Production assets contain no tested development fixture/payment/order adapter markers.

No deployment. Phase 6 only; stop for review before any further phase.
