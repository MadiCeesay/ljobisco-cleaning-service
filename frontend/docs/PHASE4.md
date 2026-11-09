# Phase 4: official quotations and private negotiation

## Review locally

Start `npm.cmd run dev` from `frontend`.

Customer: open `/login`, enable the development demo adapter, and enter sample credentials. Go to `/dashboard/quotations`. The demo includes an older superseded version, a current sent version and an expired quotation. Only the latest valid sent version has accept/decline controls. Discuss Quotation opens its private booking conversation.

Administrator: open `/admin/login` and explicitly choose **Open Administrator Demo**. This separate development tool changes the local preview role; it is not administrator registration or secure production authorization. A customer session visiting `/admin/quotations` is denied access and cannot see editor controls. Production administrator sessions must be issued and authorized by the backend.

In the administrator workspace, choose an eligible booking, add line items, expiry and optional notes, review, then deliberately send a new official version. **Switch to Customer Preview** changes the local demo role without resetting the scenario, so the issued version can be reviewed by the customer. Refresh or logout resets all quotation and conversation demo data. No quotation or message is persisted to browser storage.

## Routes

- `/dashboard/quotations`: customer quotation list.
- `/dashboard/quotations/:id`: itemization, property information, dates, current status and visual revision history; confirmation dialogs for accept/decline.
- `/dashboard/messages` and `/dashboard/messages/:bookingId`: customer conversations and booking-linked message history.
- `/dashboard/payments?quotation=:id`: non-operational deposit/full selection preview, only for a valid accepted latest version. It takes no payment and creates no payment record. Phase 5 will implement processing.
- `/admin/login`: administrator access, separate from customer registration.
- `/admin/quotations`: reusable administrator quotation form, review and issued-version list.
- `/admin/quotations/:id`: read-only administrator quotation details/history (no customer acceptance controls).
- `/admin/messages` and `/admin/messages/:bookingId`: administrator side of private booking conversations.

## Rules and status

Formal statuses are Draft, Sent, Accepted, Declined, Expired and Superseded. Revision numbers are separate from status: a revised version may be Sent or Accepted. Sent older versions become Superseded when a newer formal version is issued. Declined/expired historical outcomes remain visible. Historical line items, dates and amounts remain attached to their original version.

Customer responses require ownership, a Sent quote, a valid issue/expiry window and the highest issued version for the booking. A newer expired or declined revision never makes an older version acceptable again. The demo service independently rechecks these rules when a confirmation is submitted, including stale expected versions and duplicate responses. It refuses ordinary revision of an accepted quote.

The production frontend sends an action and expected version to the future backend; it does not optimistically accept quotations or mint authoritative prices or statuses. The backend must independently enforce all role, ownership, expiry, latest-version and concurrency checks atomically. The frontend role gates are presentation controls, not production security boundaries.

Chat text is plain text. Even a message saying “I accept” has no effect on formal quotation status. Official quotation messages link to the formal detail page; only its confirmed action can accept a valid offer. Payment selection is gated on canonical acceptance of the latest version; no real transaction or payment status transition is implemented here.

## Messaging and attachments

Conversation list, unread badges, participant labels, timestamps, message bubbles, composer, validated attachment controls, typing state, loading/retry and error feedback are implemented. Typing state is local in the demo; there is no fabricated remote administrator reply or production socket connection. New local demo messages and quotations notify in-memory subscribers. Production mode exposes an honest disconnected live-update label and a Refresh Conversations action.

Attachments allow up to three JPG, PNG, WebP or PDF files of at most 5 MB each. Development attachments are metadata marked `uploaded: false`. No fake Cloudinary URL is generated. Real attachment sending is unavailable until signed upload integration is connected. The backend must validate file content, ownership and access; unsafe or executable content is not rendered inline.

## Future API contract

All operations use the existing cookie/CSRF-aware API client. Roles and identity must come from the server session, never an actor supplied in a browser payload.

| Endpoint | Method | Contract |
| --- | --- | --- |
| `/customer/quotations/workspace` | GET | Authorized customer's `{ bookings, quotes, conversations }` |
| `/admin/quotations/workspace` | GET | Administrator-authorized workspace, eligible bookings and history |
| `/admin/quotations` | POST | `{ bookingId, items, notes, expiresAt, expectedVersion }`; server calculates totals and atomically issues the next version |
| `/quotations/:id/response` | POST | `{ action: 'accept' or 'decline', expectedVersion }`; return canonical quotation after atomic validation |
| `/conversations/:bookingId/messages` | POST | `{ text, clientRequestId }`; enforce participant membership, length, authorization and idempotency |
| `/conversations/:bookingId/read` | POST | Mark authorized participant's conversation read |

Quote records contain id, bookingId, customerId, version, status, issuedAt, expiresAt, currency GMD, line items with service-calculated amounts, total and notes. Accepted records include acceptedAt. Conversation records contain bookingId, participant/customer identity, per-role unread and typing state, and messages with sender role, timestamp and quotation reference or text/attachment metadata. These are proposed contracts, not operational backend endpoints.

## Socket.IO event contract

`socketContract.js` binds an already-provided socket. It never constructs or connects one. The application uses the adapter boundary and does not call this optional binding until a real connection is supplied.

| Event | Direction | Payload / purpose |
| --- | --- | --- |
| `conversation:join` | client → server | `{ bookingId }`; server authorizes room membership |
| `message:send` | client → server | `{ bookingId, text, attachmentIds, clientRequestId }` |
| `message:new` | server → participants | Canonical message and booking reference |
| `message:read` | bidirectional | Booking and authorized participant/read watermark |
| `typing:start` | bidirectional | Booking and server-validated participant; ephemeral |
| `typing:stop` | bidirectional | Booking and participant; expire stale typing server-side |
| `quotation:issued` | server → participants | Canonical quotation id, booking and version |
| `quotation:accepted` | server → participants | Canonical accepted quotation, booking and version |
| `quotation:declined` | server → participants | Canonical declined quotation, booking and version |

Quotation issuance/acceptance remains an authenticated formal API operation; ordinary chat events cannot substitute for it. Socket authentication, room isolation, reconnect handling, delivery receipts, attachment storage and production authorization need backend integration.

## Files and checks

New feature files are under `src/features/quotations/`: domain rules/tests, isolated demo repository, API/messaging adapters, optional socket contract, workspace hook, quotation pages/dialog/history, reusable administrator form, messaging UI and responsive styles. Existing customer demo overview, authentication role handling and `src/main.jsx` routes are integrated. Public registration retains no role selector and the homepage design is unchanged.

Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. The previously investigated upstream Zod comment warnings remain visible. Quotation/editor/chat pages are lazy-loaded so this phase does not add a large eager bundle to the homepage.

## Recorded verification

- Lint and production build passed; all 16 automated tests passed.
- Browser checks passed for quotation statuses/history, confirmation dialogs, role restrictions, revision issuance, message composition, attachment validation and acceptance-gated payment selection.
- Quotation, messaging, payment selection and administrator editor layouts passed checks at 1440, 768, 390 and 320 pixels.
- Production checks confirmed protected-route redirects, ignored forged stored roles, absent demo controls and no simulated socket connection.
- The two previously investigated upstream Zod annotation warnings remain non-blocking.

No deployment. Stop before Phase 5 for owner approval.
