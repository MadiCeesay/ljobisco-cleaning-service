> Latest implementation and verification: repository-root `MASTER_COMPLETION_REPORT.md`. It supersedes historical mandatory-customer-verification assumptions and test counts; approved designs and WhatsApp remain intact.

# Ijobisco backend

Latest frontend/backend integration results and limits: `../INTEGRATION_REPORT.md`. The shared frontend transport now uses Axios and strict-origin authenticated WebSocket connections. For owner-run Atlas development accounts, follow `docs/MANUAL_TEST_ACCOUNTS.md`; automated tests never create accounts in your existing Atlas database.

Node/Express ES modules, Mongoose/MongoDB replica-set transactions, cookie sessions, Zod, Socket.IO, SMTP and Cloudinary adapters. No deployment and no real merchant integration. The React application's approved visual architecture is retained.

## Local setup

Node 22+ (tested with Node 24.12.0), npm, and MongoDB **replica set** or Atlas are required. Docker and a permanent database are not configured on this computer. Integration tests start disposable local MongoDB replica sets and do not need your future production/development URI.

From the project root:

```powershell
cd backend
npm.cmd ci
Copy-Item .env.example .env
```

Edit `backend/.env` privately. Set `MONGODB_URI` to your own Atlas development database or local replica-set URI. Do not paste credentials into chat, commit them, or put them in `VITE_*` variables. The placeholder URI does not create a database server. For a local MongoDB installation, run `mongod --replSet rs0 --bind_ip 127.0.0.1 --dbpath <your-data-directory>`, then initialize `rs.initiate()` with mongosh. Atlas already supplies replica-set transactions; restrict its network access and use a least-privileged database account.

```powershell
npm.cmd run dev
```

In another terminal:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env.local
```

Set `VITE_API_BASE_URL=/api` in `.env.local`, then `npm.cmd run dev -- --port 5173 --strictPort`. Vite proxies `/api` to `http://127.0.0.1:4000`. Open `http://127.0.0.1:5173`. Use this exact hostname consistently; do not mix `localhost` with `127.0.0.1`. Production hosting must provide the equivalent same-origin API proxy; Vite's development proxy is not a production server. Use approved HTTPS origins and secure cookies there.

Account registration/recovery requires working SMTP. Cloudinary uploads require all three Cloudinary settings. Missing integrations return configuration-required errors rather than succeeding silently. Approved static service descriptions/images remain available before any managed records exist; no live products, prices, contacts, delivery fees or pickup locations are seeded.

### Administrator provisioning

```powershell
cd backend
npm.cmd run bootstrap-admin
```

Use a private interactive terminal and database administrator access. Enter an email/name and hidden strong temporary password; confirm `CREATE ADMIN`. The command refuses existing emails and never promotes a public account. Public registration rejects roles and always creates CUSTOMER accounts. Bootstrap verifies the administrator explicitly; rotate its temporary password using configured reset email. No sample administrator credential exists in source. Additional admin provisioning is an operator procedure, not a public API.

### Local payment simulation

Only for disposable development data: set `MOCK_PAYMENTS_ENABLED=true` in backend `.env` and `VITE_LOCAL_MOCK_PAYMENTS=true` in frontend `.env.local`, restart both servers. The backend must bind loopback. The customer must formally accept the latest valid quotation first. The mock adapter confirms a **simulated** result; no money moves and no card data is collected. Database-backed simulations persist, unlike the separate in-memory frontend demo. Production refuses mock configuration and the frontend strips its local mock switch.

Administrators must configure real approved pickup/delivery details before connected checkout. Do not enable fulfilment using test details for actual customers. Order creation reserves/deducts stock transactionally; unpaid reservations expire after 30 minutes. Creating an unpaid order is not payment success. Wave and APS adapters intentionally fail closed; verified merchant documentation, credentials, webhook signatures and reconciliation remain blockers.

## Environment

See `.env.example`. Required: `MONGODB_URI`, `FRONTEND_ORIGINS` (comma-separated exact origins), `PUBLIC_APP_URL` (one allowed frontend origin). Defaults: `NODE_ENV=development`, `PORT=4000`, `HOST=127.0.0.1`, `SESSION_TTL_HOURS=24`, `COOKIE_SAME_SITE=lax`, mock payments disabled.

Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional `SMTP_USER`/`SMTP_PASS`, `SMTP_FROM`. Production STARTTLS is required when implicit TLS is not selected. Configure authenticated provider domains and deliverability externally. Account tokens are only sent by email; no reset/verification tokens appear in API responses or logs. SMTP failures can leave an unverified registration; use `/auth/resend-verification` after fixing configuration. Delivery acknowledgements are not proof of inbox delivery.

Images: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Credentials are server-only. Private assets use authenticated delivery and authorized, 60-second signed download redirects. The API inspects/normalizes image bytes before upload; there is no unrestricted direct browser signature endpoint.

## Checks

```powershell
cd backend
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd audit
cd ../frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Backend build checks syntax of runtime/scripts; Node runs ES modules directly, so no generated backend bundle is needed. Tests use actual isolated MongoDB transactions and HTTP/Socket.IO. Only SMTP/Cloudinary/provider boundaries are injected; test fixture inventory is created inside disposable databases, never seeded into the application.

First test run may download MongoDB through mongodb-memory-server. On Windows, `node scripts/test-mongo.js` optionally downloads only `mongod.exe` from the official HTTPS ZIP, validating entry size/CRC; it avoids downloading debugging symbols. Requires Node with `zlib.crc32` (tested Node 24). Saved executable is ignored in `.cache/`; it is a test helper, not a persistent database installer. Alternatively set `MONGMS_SYSTEM_BINARY` to a trusted installed binary. No live database tests are run against your `.env` URI. Slow local test process startup allows 60 seconds without skipping assertions.

## Documentation and limitations

- `docs/API.md`: implemented endpoints and contract differences.
- `docs/MODELS_SECURITY.md`: persisted models, authorization, money/concurrency guarantees and known limitations.
- `docs/READINESS.md`: external configuration, operational/security acceptance checklist and actual verification results.
- `docs/PROGRESS.md`: sequential phase gates and test history.

This is an implemented and locally tested backend foundation/workflow, **not a production-readiness certification**. Live SMTP/Cloudinary, merchant APIs, hosting TLS/proxies, backup/restore, load testing, cross-browser API workflows, legal policies and independent security review need owner configuration and verification. No deployment is performed.

## WhatsApp support

In administrator Settings, publish only the verified official business WhatsApp number in international +country-code format. Blank means unavailable; no number is supplied by default. Customer/admin messages routes are now WhatsApp support pages. Discussion does not alter formal quotations, payments or audit history. Socket.IO is removed. See `docs/API.md` and the root `WHATSAPP_INTEGRATION_REPORT.md` for the current architecture and verification.

Customer registration defaults to `REQUIRE_EMAIL_VERIFICATION=false` and does not require SMTP. Email verification remains a distinct stored fact; ADMIN verification is always enforced. Keep password recovery SMTP configured separately. Templates contain no credentials; use private `.env` and rotate any credentials previously copied into `.env.example`. Local mock payments require explicit non-production loopback-only enablement. See the completion report and manual-test guide before testing against Atlas.
