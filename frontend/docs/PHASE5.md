# Phase 5 — Payments, checkout and orders

## Local review

Run `npm.cmd run dev` from `frontend`. In `/login`, explicitly enable the development customer preview. Accept the latest quotation at `/dashboard/quotations`, then open its payment link. Try the failed and successful mock outcomes. A deposit leaves a locked balance: only backend-confirmed completion can unlock it. The demo does not manufacture completion or expose a customer completion control.

For products, open `/shop?demo=1`, add fixture products and continue through `/cart` to `/checkout`. Enter sample information, review the order and explicitly acknowledge that it is simulated. Inspect the confirmation, `/dashboard/orders` and `/dashboard/orders/:id`. Failed mock checkout leaves the cart intact; successful mock checkout clears the submitted items. Real fulfilment is never arranged.

## Boundaries

- `VITE_DEPOSIT_PERCENT` configures the preview percentage, defaulting to 30 for missing/invalid values. All actual amounts and percentages must eventually be returned and validated by the backend. Money previews use integer minor units.
- The mock gateway is available only with development customer authentication. Wave and APS remain disabled and explicitly unconnected. No real card data is collected.
- The isolated, dynamically imported development adapter confirms simulated outcomes asynchronously. It rechecks latest accepted quotation ownership/version, calculates amounts from its own quotation/catalogue records, rejects concurrent requests and deduplicates request identifiers. Chat or clicking a button does not directly mark payment paid.
- Demo payments and orders remain in memory; no sensitive checkout details, prices or transactions are saved to local storage. Logout and refresh reset demo records. Cart storage remains identifiers and quantities only.
- Delivery fees, delivery areas and pickup locations are unconfigured. The final payable total is explicitly pending. An acknowledged mock order records only a fixture-products subtotal and stays pending configuration; it is not a real order or inventory reservation.
- Live payment initiation and order creation intentionally fail closed until backend configuration and providers exist. The future backend must authorize account ownership, verify quote acceptance and completion, recalculate totals/stock/fees, enforce idempotency and validate signed provider webhooks before updating payment/order states. Cookie/CSRF API reads use `/customer/payments-and-orders`; mutations are not wired to an unverified live endpoint.
- Status badges support Pending, Processing, Partially Paid, Paid, Failed and Refunded. No customer-controlled refund action is provided. Payment history and order timelines display adapter records rather than fabricated progress.

## Changed areas

New `src/features/payments/` contains calculation/validation rules, tests, development adapter, production boundary, responsive payment/checkout/order pages and styles. Routing, the demo dashboard overview/reset and cart summary copy integrate Phase 5 without redesigning approved pages.

## Verification results

- Lint passed; all 24 automated tests passed, including deposit/full previews, rounding, balance gating, checkout validation, adapter outcomes, idempotency, canonical fixture prices and session reset.
- Production build passed. The two existing upstream Zod annotation warnings remain non-blocking.
- Browser checks passed for formal-acceptance gating, deposit/full selection, failed/successful simulated payments, partial-payment history and locked balances.
- Cart-to-checkout, delivery validation, pickup review, explicit simulation acknowledgement, failed-order cart retention, successful-order cart clearing and order history passed browser checks.
- Payment layouts and checkout were checked at 1440, 768, 390 and 320 pixels; mobile confirmation screenshots were visually reviewed.
- Production browser checks confirmed fixtures and demo authentication are absent, mock checkout is unavailable and payment/order routes require authentication. A bundle scan found no demo payment/order adapter or inventory markers.

No deployment. Stop before Phase 6 for approval.
