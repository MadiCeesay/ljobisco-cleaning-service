# Render backend and Vercel frontend

## Prepared configuration

- Backend uses Node 24.x, reads Render's assigned PORT and binds to 0.0.0.0 in production. Render settings specify one trusted proxy hop. Credentials never belong in Git or VITE variables.
- render.yaml is an optional Blueprint. For the existing manually created service, update its settings/environment directly; adding YAML to Git does not automatically update that service.
- frontend/vercel.json preserves React Router deep links. Set Vercel Root Directory to frontend, Framework to Vite, install with npm ci, build with npm run build, and output directory dist.
- Local backend/.env remains development-only with localhost URLs; production settings are separate.

## Existing Render service: deploy before Vercel exists

1. Commit/push the deployment source changes before redeploying. The previous deployed commit does not understand FRONTEND_PENDING.
2. Use backend as Root Directory, npm ci --omit=dev as Build Command, npm start as Start Command, /ready as Health Check Path, and NODE_VERSION=24.
3. Run node scripts/prepare-render-env.js from backend to generate private backend/.env.render from the existing private provider values. The file is ignored by Git. It retains provider values; it cannot revoke or rotate exposed credentials. Replace those with freshly issued credentials privately before importing into Render.
4. In Render Environment, delete the old FRONTEND_ORIGINS and PUBLIC_APP_URL entries for now. Import backend/.env.render. Also remove a manually overridden PORT; Render supplies it. Do not manually set RENDER or RENDER_EXTERNAL_URL.
5. FRONTEND_PENDING=true requires Render production and its injected RENDER_EXTERNAL_URL. The backend permits only its own actual HTTPS origin during this temporary mode, not a guessed Vercel address or wildcard. Email delivery is disabled because there is no real frontend link destination yet. Public readiness/service endpoints can be checked, but cross-site customer login is not enabled.
6. Atlas must allow the Render service's outbound addresses and the database user must have appropriate access to the chosen database. A permitted laptop IP does not permit Render. Use the correct database name intentionally; do not silently change databases or migrate/delete records.
7. Redeploy. GET https://<actual-render-host>/ready must return HTTP 200 with {"status":"ready"}. Absence of a local .env file on Render is normal. Variables come from the dashboard.

## Deploy frontend, then connect it

1. Import this GitHub repository into Vercel with Root Directory frontend.
2. For a public-only initial deployment, leave VITE_API_BASE_URL empty and VITE_LOCAL_MOCK_PAYMENTS=false. This does not enable production demo authentication/inventory or pretend the API is connected. Do not set /api on Vercel unless an actual API proxy is configured; the Vite development proxy is not deployed.
3. Once Render is ready, set Vercel VITE_API_BASE_URL to https://<actual-render-host>/api and rebuild. Only this public API URL goes into VITE variables; no provider secrets.
4. Set Render FRONTEND_PENDING=false, FRONTEND_ORIGINS to the actual exact HTTPS Vercel production origin and PUBLIC_APP_URL to that same origin, with no trailing slash/path. Remove unused preview origins. Redeploy.
5. For direct browser requests between unrelated vercel.app/onrender.com domains, COOKIE_SAME_SITE=none and Secure production cookies are required. Axios already sends credentials; backend CORS and CSRF remain restricted. Browser third-party-cookie policies may still block sessions. Prefer owned app/api subdomains on the same site, or configure and test a same-origin API rewrite after the actual backend URL is known; this update does not promise universal cross-site cookie support.
6. Verify login, refresh/session restoration, CSRF writes, logout, role guards, uploads and WhatsApp on the actual deployed origins before launch. Do not use mock payments in production. SMTP and Cloudinary require rotated, valid provider credentials; their delivery/upload behavior is not verified merely by a successful build.

## Important limitations

No cloud dashboard settings are changed by local edits. No deployment, provider credential rotation or real production payment setup was performed by this preparation. Exposed Atlas/SMTP/Cloudinary credentials and the chat-exposed administrator password must be replaced privately before public use. Do not paste .env contents or select secrets in IDE context shared with chat.

## Platform references

Local verification: backend lint, all 25 automated tests and syntax build passed; frontend lint, all 52 automated tests and production build passed. The frontend retains two upstream Zod annotation warnings. The private generated Render settings were parsed with simulated Render platform variables (no cloud deployment or database writes), and the publishable source scan found no matches for private environment credentials. Actual Render/Vercel deployment and production authentication remain unverified.

- Render web services and port binding: https://render.com/docs/web-services
- Render-provided service URL and port: https://render.com/docs/environment-variables
- Render environment variable import: https://render.com/docs/configure-environment-variables
- Vercel SPA routing configuration: https://vercel.com/docs/project-configuration/vercel-json
