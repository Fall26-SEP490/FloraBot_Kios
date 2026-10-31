# FloraBot Kiosk

Dedicated kiosk repository, extracted from FloraBot_FE. Requires Node.js 24 and pnpm 11.10.0.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

For development, set API_PROXY_TARGET to the running API/gateway origin, then run pnpm dev.
Copy `.env.example` to `.env.local` at the repository root; Vite reads that directory. To connect local development to the real server, set `API_PROXY_TARGET=https://api.florabot.site`. This server-only setting is never included in the browser bundle.
The UI is at http://127.0.0.1:5174. Device provisioning is required for real kiosk operations.
Shared contracts and UI are local snapshots so this checkout builds independently.
The composed stack builds `kiosk-web` from this repository via `../Kios`, and FE integration tests also start this standalone application.

For the composed stack and cross-repository integration tests, check out BE, FE, Kios and AI as sibling directories with those short names, or provide equivalent directory aliases. Cloning only this repository is sufficient for its own lint, typecheck, build and mocked browser tests.

Contract snapshots are not automatically synchronized with FE or BE. Review and regenerate them from the backend OpenAPI when a kiosk-consumed endpoint changes; do not hand-edit generated types. Additive portal-only API changes do not by themselves require changing kiosk behavior.

## Home and customer journeys

A provisioned kiosk opens Home first. Customers choose walk-in shopping or preorder collection; the VI/EN control is shared by the real customer screens. Selecting staff links to the authenticated website workspace and does not grant hardware access.

- Walk-in stock comes from `/api/kiosks/{id}/catalog/items`, including its physical slot and shop photo when available. Generic photos remain labelled illustrations. Basket checkout and payment amounts are owned by the backend.
- Payment QR uses the signed payOS `qrCode` returned by the backend. Older backends without that field retain the payOS checkout-link QR. A browser redirect never marks a payment successful. Backend/device status drives payment, dispensing and collection feedback.
- Preorder collection accepts only the eight-digit email pickup OTP. After payment and stocking, the Seller sends it to the Customer's login email through `POST /api/me/preorders/{requestId}/pickup-otp`. No phone or receipt UUID is required. The code is kiosk-bound, single use and valid only within the pickup window.
- Explicit confirmation calls `POST /api/kiosks/{id}/preorders/pickup-otp/open` with `{code,attemptId}`. An ambiguous response is never automatically retried; a manual check reuses the same attempt ID and receives the same command. Status polling uses the returned `X-Pickup-Token` header, held only in memory. Home, hidden tabs and three-minute inactivity discard state. Preorders have no receipt-opening fallback; walk-in receipt recovery remains.
- Device support QR opens an anonymous mobile report form; a report enters the admin incident queue without changing slots, payments or locks. Shop support QR opens the website shop-contact page and its authenticated customer/shop chat.

Deploy the matching BE migration `20261031_preorder_email_pickup_otp.sql`, API, Seller website send-code button and Kiosk together. Email uses the existing BE transactional-email configuration. The existing MQTT credentials/ACLs, HMAC keys, heartbeat and physically closed doors remain required for actual dispensing. No firmware pin changes are required by this UI work.

Build-time kiosk configuration:

- `VITE_PORTAL_URL`: website origin (default `https://florabot-fe.vercel.app`).
- `VITE_PUBLIC_KIOSK_URL`: public kiosk URL used in device-support QR codes (default `https://florabot-kiosk.vercel.app/`). Do not use localhost for a QR scanned by a separate phone.
- `VITE_RECEIPT_URL`: optional full electronic receipt page URL.
- `API_PROXY_TARGET`: local development API/gateway; browser/device keys never enter support QR codes.

`vercel.json` builds from the repository root into `apps/kiosk/dist` and proxies `/api/*` to `https://api.florabot.site/api/*` before SPA navigation fallback. Vercel uses the root `/` base path; the Docker image continues to use `/kiosk/`. Do not set `VITE_BASE_PATH=/kiosk/` for the standalone Vercel domain. No device key belongs in a `VITE_*` variable or a committed environment file.

## UI preview without IoT

Open `/?preview=1`, or choose “Xem giao diện mẫu” from setup, to view the Home screen and isolated simulator. This mode never uses the provisioned device credentials, creates a payment or sends a hardware command. Its sample codes are isolated demo data; the connected kiosk uses the email pickup flow above. Exiting preview returns to the provisioned Home, or setup if no device is connected.

## Contract generation

Export the actual schema using the BE checkout's supported workflow, or save the authenticated `/openapi/v1.json` response. Do not initialize or reset a database just to generate contracts. This BE revision does not implement a `--export-openapi` CLI flag.

Copy that exported schema to `packages/contracts/openapi.json`, then run:

```sh
pnpm exec openapi-typescript packages/contracts/openapi.json -o packages/contracts/src/generated/api.d.ts
```

The email pickup contract is a separate additive snapshot because the main kiosk snapshot contains APIs from a different BE revision. From an actual `/openapi/v1.json` export, run:

```sh
node packages/contracts/sync-pickup-otp.mjs /path/to/exported-openapi.json
pnpm exec openapi-typescript packages/contracts/openapi-pickup-otp.json -o packages/contracts/src/generated/pickup-otp-api.d.ts
```

Generated contracts are not edited by hand. Browser tests mock the backend and gateway; passing them does not claim real email delivery, a bank transfer or a physical locker cycle.
