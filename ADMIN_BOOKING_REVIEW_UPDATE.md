# Simplified administrator booking review

## Explicit request approval

New requests now show Approve Request, followed by a confirmation dialog. Successful approval is persisted with `requestApprovedAt`, an incremented revision, booking history and a `booking.request-approved` audit entry. It keeps the compatible Under Review workflow status and reveals Create Quotation. Approval does not set prices, accept quotations, take payments or confirm dates. The administrator-only endpoint rejects stale/repeated approvals and already-quoted/closed requests. No customer/admin role protection is bypassed.

The running Vite server on port 5173 was checked directly: it serves the new Approve Request action and neither of the obsolete large forms. If the old forms remain in a browser, refresh that browser tab and verify its URL points to this local app.

- New requests focus on customer details, cleaning requirements, photographs, WhatsApp and Create Quotation. Existing quotations have View/Revise actions; Create/Revise preselects the relevant eligible booking.
- Removed the large information-request form from this interface. Clarification is handled on WhatsApp; historical clarification/audit records and backend endpoints are preserved.
- Scheduling appears only after the latest quotation is accepted and the backend reports that the locked required deposit has been paid. A compact expandable form asks only for date and time window.
- Scheduled bookings show Start Cleaning. In-progress bookings show Mark Cleaning Complete. Each action requires confirmation, preserves the recorded appointment and submits an explicit audit note through the existing revision-checked administrator endpoint.
- Closed bookings retain quotation/history access without unnecessary disabled WhatsApp controls. Booking history is collapsed by default; unused optional detail rows are omitted.
- No request approval, customer acceptance, payment, or appointment is inferred from WhatsApp. Backend role checks, payment eligibility, status transitions, optimistic revisions and completion rules remain authoritative.

## Verification

- Frontend lint, 52 automated tests and production build passed. Build retains two existing upstream Zod annotation warnings.
- Backend lint, lifecycle tests (2) and syntax build passed. Lifecycle tests now assert backend scheduling eligibility before payment, after the deposit, and after completion.
- Isolated Chrome checks passed at 1440, 768, 390 and 320 pixels: removed fields, booking preselection, locked/unlocked scheduling, confirmation dialogs, start/completion progression and no horizontal overflow. Browser API mutations were intercepted fixtures; database lifecycle tests used disposable MongoDB databases.
- No deployment or GitHub push was performed for this update. Real customer booking records were not changed by testing.
