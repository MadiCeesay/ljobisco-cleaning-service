# Cleaning services focus

Property type has also been removed from the request form and review. Both API validators accept an omitted/blank property type without inferring it from a service category; historical property types remain supported.

- Shopping navigation, homepage product promotion, cart controls, customer orders navigation, administrator product/order navigation and stock metrics are removed from the active frontend. Old commerce URLs redirect to Services.
- Existing commerce modules, backend APIs and historical records are retained to avoid deleting financial/order history. They are not part of the current website journey. Cleaning quotation/payment workflows remain unchanged.
- Requests now use three steps: Your clean, Location & contact, Review & send. Required details are service, property type, cleaning description, phone, address and town. Room count and preferred date are optional in both frontend and backend validation.
- Removed separate size, special requirements, directions and time-window inputs. Customers describe special needs in the single description. Legacy payload fields remain compatible (blank optional details and Flexible time). No room counts, dates, prices or confirmed appointments are invented.
- Photos remain optional, collapsed on review, with type/size validation, previews and removal. Uploads still require configured storage; no upload bypass was added.
- Owner-supplied WhatsApp number 5393273 is treated as Gambian: +2205393273. Public business API and UI use this approved fallback; a valid administrator-configured number takes precedence. Blank settings restore the approved number.
- WhatsApp buttons use the WhatsApp brand mark, a green accessible button and https://wa.me/2205393273. Booking links include only a safe booking reference and optional quotation version. WhatsApp opens externally; customers must send the message themselves. No quotation/payment changes occur through chat.
- No Atlas records were changed by this update. Automated mutation tests use disposable databases. No deployment.

## Verification

- Frontend lint passed; 51 automated tests passed. Production build passed with the two existing upstream Zod/Rollup annotation warnings.
- Backend lint and syntax build passed; all 21 automated tests passed against disposable MongoDB replica sets, including persistence of requests without room counts or preferred dates.
- Isolated Chrome checks passed at 1440, 768, 390 and 320 pixels: no shopping controls, legacy URL redirects, three-step form validation, optional rooms/date, no premature submission, photo add/remove, no horizontal overflow and no JavaScript errors.
- Four WCAG-tagged axe scans of the reviewed booking form passed with zero violations. Visual review found and corrected a premature-submit issue; contrast scanning found and corrected the WhatsApp button contrast.
- Clicking the WhatsApp action opened the expected external URL in the browser test. The external request was intercepted; no WhatsApp message was sent and account ownership/delivery was not verified.
- Read-only requests to the real backend on port 4000 and the frontend proxy on port 5173 both returned HTTP 200 and the approved WhatsApp number. Browser mutation interactions used isolated API fixtures; real Atlas customer requests were not submitted by these checks.
- Existing broad legacy commerce browser audits are retained as historical scripts; `npm run test:browser` now runs the cleaning-focused browser regression. Set `QA_MODULE_ROOT` to the installed Playwright/axe tools directory, as with the previous browser audit.
