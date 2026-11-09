# Phase 3: customer accounts and cleaning requests

## Local review

Run `npm.cmd run dev` from `frontend`. Open `/login`, select **Use development demo adapter**, and enter a sample email and any non-empty sample password. Demo access deliberately does not verify real credentials and must never be considered secure authentication. Use sample information only.

Registration, forgot-password, reset-password and verify-email forms also offer the explicit development-only toggle. They validate inputs and report local-only outcomes without creating real accounts, changing real credentials or sending emails. Reset and verification forms require a token; use a sample token in demo mode.

Demo sessions, account information, requests and draft photographs exist only in memory. A refresh ends demo authentication and resets the fixture data; logout clears account data and the booking draft. No authentication tokens or customer information are stored in localStorage or sessionStorage. Existing cart persistence remains identifier-and-quantity only.

## Routes

- Public account forms: `/register`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`.
- Protected request form: `/bookings/new`.
- `/request-quote` redirects to the request form, preserving the service query.
- Protected dashboard: `/dashboard`, `/dashboard/bookings`, `/dashboard/bookings/:id`, `/dashboard/quotations`, `/dashboard/messages`, `/dashboard/payments`, `/dashboard/orders`, `/dashboard/profile`.

Unauthenticated access redirects to login with a validated local return destination. The selected cleaning service survives the redirect. Customer routes require a customer role for presentation purposes; the backend must enforce all authorization independently. Public registration offers no administrator role.

## Booking flow

1. Service selection.
2. Property type, rooms/areas, optional approximate size and special requirements.
3. Location, directions, preferred date and time window.
4. Cleaning description and optional photographs.
5. Review, previous-step corrections and explicit submission.

Drafts survive step changes and navigation within the current app session. They are not persisted to disk. Refresh and logout clear them. Photographs are validated as non-empty JPG, PNG or WebP images, at most 5 MB each and eight files total. Local preview URLs are revoked when attachments are removed or the form unmounts.

The development adapter returns a clearly local request record with `Submitted` status; attachments are metadata marked `uploaded: false`, not fabricated Cloudinary URLs. No customer can set authoritative status, calculate a cleaning price or issue a formal quotation. The administrator sends the first quotation after review and may request clarification or additional photos; an on-site inspection is not required for every quotation. Preferred dates are not confirmed appointments.

Reported status vocabulary: Submitted, Under Review, Awaiting Information, Quoted, Accepted, Awaiting Payment, Scheduled, In Progress, Completed, Cancelled. Unknown statuses display as unavailable rather than being inferred.

## Future Express API contract

Set `VITE_API_BASE_URL` in a local environment file only when an actual backend is available. With no base URL, real adapter actions fail honestly before transmitting data. The Vite-exposed variable must contain only a public API base URL, never secrets.

`src/services/apiClient.js` uses `credentials: 'include'`, requests a CSRF token from `GET /auth/csrf` before mutations, and keeps that CSRF value in memory. The backend should issue HttpOnly, Secure cookies with an appropriate SameSite policy, validate CSRF tokens, configure credentialed CORS for approved origins, enforce rate limits and verify ownership and roles. No JWT localStorage strategy is implemented.

Expected endpoints (proposed integration contract, not an operational server):

| Endpoint | Method | Expected behavior |
| --- | --- | --- |
| `/auth/csrf` | GET | `{ csrfToken }` |
| `/auth/session` | GET | `{ user }`, customer profile or unauthenticated response |
| `/auth/login` | POST | Email/password, cookie session, `{ user }` |
| `/auth/register` | POST | Name/email/phone/password; server must create CUSTOMER only |
| `/auth/logout` | POST | Invalidate cookie session; 204 or JSON |
| `/auth/forgot-password` | POST | Email; generic anti-enumeration response |
| `/auth/reset-password` | POST | Reset token and new password |
| `/auth/verify-email` | POST | Verification token |
| `/customer/overview` | GET | `{ bookings, quotations, messages, payments, orders }` arrays scoped to the customer |
| `/customer/profile` | PATCH | Name/email/phone; `{ user }`; backend must handle email-change verification |
| `/bookings` | POST | Validated requirements and uploaded attachment references; canonical request with `{ id, status, ... }` |

The Cloudinary boundary is `uploadService.prepare` in `features/customer/services.js`. It currently refuses real photo uploads. Replace its production branch with a backend-signed Cloudinary integration; keep signing secrets server-side and validate actual file content, ownership and sizes on the backend. No Cloudinary upload, email, payment or secure production authentication is claimed.

Quotation, messaging, payment and order dashboard routes contain account summaries or honest empty states. Formal acceptance, negotiation chat, payment processing and order workflows belong to later phases and are not implemented here.

## Files and verification

Added customer feature modules under `src/features/customer/`, `src/services/apiClient.js`, `.env.example` and this document. Updated `src/main.jsx` routing and account navigation, plus the test command in `package.json`. Approved homepage content, image assets and public-page designs are preserved.

Run `npm.cmd test`, `npm.cmd run lint` and `npm.cmd run build`. The installed Zod dependency still emits its two previously investigated non-blocking comment annotation warnings. No warning suppression or dependency patch was added.

Phase 3 stops before quotation management, messaging or payment integration. Nothing is deployed.

### Recorded results

- All 11 unit tests pass, including registration/confirmation validation, role-field stripping, recovery tokens, safe return destinations, booking/date rules, image validation and the existing cart persistence tests.
- Browser checks pass for registration/login errors, explicit demo actions, password visibility, protected redirection with service preservation, all five booking steps, previous/next controls, draft preservation through navigation, image type/size errors, preview removal, review before explicit submission, demo request details, profile changes and logout.
- Browser storage checks find no passwords, profile information, addresses or photo data persisted by the customer flow.
- Dashboard and booking routes pass layout checks at 1440, 768, 390 and 320px. All five account forms pass at those widths with labelled inputs, one main heading and no horizontal overflow. Mobile dashboard navigation works.
- Production preview keeps all nine customer destinations protected, ignores fake localStorage authentication, and exposes no demo-adapter switch. Compiled production assets do not contain the demo customer/booking fixture records.
- Lint and production build pass. The same two upstream Zod annotation warnings remain. No browser runtime errors were observed.

These are frontend checks, not evidence of operational backend authentication, upload delivery or payment processing.
