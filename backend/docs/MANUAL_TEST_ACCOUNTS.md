# Secure manual test accounts for your Atlas development database

These are **owner-run instructions**, not actions already performed. Automated integration tests use disposable databases. No customer/admin account or test inventory was inserted into your existing Atlas database by this integration pass.

## 1. Confirm development-only configuration

- Use a dedicated Atlas **development database**, not production. Verify the database name in your private `backend/.env` yourself; never paste its URI/password into chat or the frontend.
- Limit Atlas network access and database-user privileges appropriately. Keep `.env` ignored. Do not replace or delete existing data to run these checks.
- Backend origins/app URL should match `http://127.0.0.1:5173`; frontend `.env` should contain `VITE_API_BASE_URL=/api`.
- Keep mock flags false unless explicitly testing with a dedicated development database. To test simulated payments locally only, use NODE_ENV=development, HOST=127.0.0.1, backend MOCK_PAYMENTS_ENABLED=true and frontend VITE_LOCAL_MOCK_PAYMENTS=true. Restart both servers. Never enable these flags in production. Automated tests use separate disposable databases.
- Configure SMTP using your provider's actual `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, authentication if required, and approved `SMTP_FROM`. Use a mailbox you control. Use REQUIRE_EMAIL_VERIFICATION=false for immediate customer registration/login without SMTP; this never marks the email verified. Password recovery still requires SMTP. For a verification-required test set the flag true and configure SMTP first. Administrators always require verification.
- Restart the backend after changing `.env`; refresh/restart Vite after changing frontend environment settings.

Check readiness in PowerShell:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:4000/ready' -Method Get
```

Expected `status: ready` means a fresh database ping succeeded, not that SMTP/Cloudinary/payment providers work.

## 2. Provision an administrator privately

From the project root in a private interactive terminal:

```powershell
cd backend
npm.cmd run bootstrap-admin
```

The command uses your configured database. Enter an administrator email you control, a name and a unique hidden temporary password (at least 12 characters; no more than 72 UTF-8 bytes). Password input is deliberately invisible; type/paste it and press Enter. Type `CREATE ADMIN` only after confirming you are targeting the correct development database. The shared provisioning function sets ADMIN privately, refuses an existing email and never promotes/overwrites a CUSTOMER account. No public registration role field exists. Use a long, unique password for production; do not reuse a password shared in chat.

Use a password manager and a separate administrator browser profile/window. Open `http://127.0.0.1:5173/admin/login` and sign in normally. Do not share this password or account cookie. Rotate the temporary password using the configured password-reset email flow; reset revokes existing sessions. No default administrator credential is shipped.

## 3. Register a customer through the public UI

In a different browser profile/private context, open `http://127.0.0.1:5173/register`.

1. Enter a clearly identified manual-test customer name, your controlled email, phone and a unique password (minimum 8 characters; longer passphrases are encouraged).
2. Submit normally. The backend creates CUSTOMER accounts only and must have working SMTP.
3. Open the verification message in your controlled mailbox and use its verification link/token. Do not post the token in chat, screenshots or logs.
4. Sign in at `/login`, refresh `/dashboard` and confirm the cookie session restores.
5. Change name/phone on `/dashboard/profile`, save and refresh. Email is intentionally read-only until a separate verified-email-change workflow is available.

If SMTP fails after registration, correct its configuration and request a new verification token through the authenticated-origin, CSRF-protected `/api/auth/resend-verification` endpoint. The current verification page accepts tokens; a dedicated resend-email UI is not yet supplied. Do not manually flip `verified` in MongoDB as a shortcut. An already-existing unverified email is not silently promoted or replaced by registration.

## 4. Manual workflow checks

- Submit a clearly labelled development cleaning request. Start without photographs to distinguish booking integration from Cloudinary configuration. Preferred dates remain requests, never guaranteed appointments.
- In the administrator context, review that request and issue a formal itemized quotation. Discuss it from both customer/admin conversation pages. Connected status and automatic incoming messages should appear with the WebSocket upgrade proxy working.
- Issue a revision after negotiation. Verify the older version cannot be accepted, and accept only the latest offer from the customer context.
- Review deposit/full/balance previews. Actual payments must stay unavailable while Wave/APS are unconfigured; do not infer payment success from a UI action. Balance is gated by administrator-confirmed completion and backend ledger state.
- Product checkout requires owner-approved catalogue images/prices/stock and explicit pickup/delivery configuration. Empty catalogue/unconfigured fulfilment is correct until supplied. Creating an unpaid order is not a payment; unpaid stock reservations expire after 30 minutes.
- Register and verify a second controlled customer email, then verify that its dashboard cannot see the first customer's booking/quotation/message/order records. A customer must never enter administrator operations.
- Log out, refresh a protected URL and verify redirection to login. Keep administrator/customer cookies in separate browser contexts.

Cloudinary variables may be present without a working provider connection. Verify them with your own account and a permitted test image only when ready. Private photographs must remain authenticated/owner-controlled; do not use a public image URL as a substitute. Real SMTP, Cloudinary, merchant delivery/settlement and authenticated Atlas workflows are **not claimed verified** by disposable integration tests.

## Immediate customer signup

With REQUIRE_EMAIL_VERIFICATION=false, use the four-field /register form. It creates an unverified CUSTOMER and logs in immediately through the normal cookie endpoint; no email is sent. If a prior failed email attempt already created the account, log in using that account rather than deleting records or weakening security. Profile phone is optional; provide a contact phone in the booking/checkout flow. With mandatory verification enabled, use the existing email link or /verify-email resend form first.

## Credential rotation

Apparent credentials were found in the former backend/.env.example. Its contents are now sanitized, but removing a file value does not revoke it. Rotate the Atlas database password and Cloudinary API secret in their provider consoles, update only private backend/.env, and restart. Do not paste secrets into chat, source, reports or frontend VITE variables. Purge any previously shared copies/history as appropriate. This pass did not rotate provider credentials or modify your existing Atlas data.
