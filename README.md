# FloraBot Kiosk

Dedicated kiosk repository, extracted from FloraBot_FE. Requires Node.js 24 and pnpm 11.10.0.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

For development, set API_PROXY_TARGET to the running API/gateway origin, then run pnpm dev.
The UI is at http://127.0.0.1:5174. Device provisioning is required for real kiosk operations.
Shared contracts and UI are local snapshots so this checkout builds independently.
The composed stack builds `kiosk-web` from this repository via `../Kios`, and FE integration tests also start this standalone application.

For the composed stack and cross-repository integration tests, check out BE, FE, Kios and AI as sibling directories with those short names, or provide equivalent directory aliases. Cloning only this repository is sufficient for its own lint, typecheck, build and mocked browser tests.

Contract snapshots are not automatically synchronized with FE or BE. Review and regenerate them from the backend OpenAPI when a kiosk-consumed endpoint changes; do not hand-edit generated types. Additive portal-only API changes do not by themselves require changing kiosk behavior.

## UI preview without IoT

When no device is provisioned, the app opens device setup, preserving the tablet setup and preview from `main`. “Xem giao diện mẫu” opens that isolated tablet preview; “Xem mẫu và danh mục website” opens the flower catalog preview. `?preview=1` opens the catalog preview directly even if a device session exists; `?setup=1` opens the normal setup/device journey. The catalog preview includes flower selection, basket/message, payment layout and pickup screens. Sample photos/prices are labelled, and all transitions stay in memory. It never creates an order/payment, sends a device command, uses a device key or claims a physical pickup. Enter `DEMO2026` to view the final screen.

The optional “Danh mục API” source reads only public `GET /api/shop/catalog` and `GET /api/kiosks`, omitting cookies. It shows the first web-catalog page, not physical WALK_IN inventory; API emptiness/errors never silently become sample inventory. The real device journey remains separately protected by provisioning and its existing backend policies.

For the local FE URL `http://localhost:8088/kiosk/?preview=1`:

```powershell
$env:VITE_BASE_PATH='/kiosk/'
$env:VITE_WEB_URL='http://localhost:8088'
$env:API_PROXY_TARGET='http://127.0.0.1:5080'
pnpm build
pnpm --filter @florabot/kiosk preview
```

FE forwards `/kiosk/*` to port 5174. For standalone development at port 5174 with the default root base, use `pnpm dev` and set `VITE_WEB_URL` to the actual website origin. Use `VITE_RECEIPT_URL` for the real device receipt handoff; it is unrelated to the preview code.

## Vercel Deployment

For standalone kiosk deployment on Vercel:

- **Root Directory**: `apps/kiosk`
- **Framework Preset**: `Vite`
- **Output Directory**: `dist`
- **Build Command**: default (`tsc --noEmit && vite build` via pnpm workspace)
- **Monorepo Settings**: Enable **"Include source files outside of the Root Directory in the Build Step"** (`outsideRootpackages`) so pnpm workspace can access `@florabot/ui` and `@florabot/contracts` packages.

### Environment Variables

Configure public build-time environment variables in Vercel project settings:
- `VITE_BASE_PATH=/`: Root base path for standalone deployment.
- `VITE_WEB_URL=https://florabot-fe.vercel.app`: Public frontend origin used for store links and navigation.
- `VITE_RECEIPT_URL=https://florabot-fe.vercel.app/receipt`: Target URL base for real device receipt handoff (formats `#order={id}&token={token}` for customer mobile QR scanning and direct receipt access; unrelated to preview mode).

> **Security Note:** Environment variables are strictly public (`VITE_*`). **Never** store or configure device keys (`X-Kiosk-Key`) in deployment environment variables.

### API Rewrites (`apps/kiosk/vercel.json`)

Ordered rewrites configured without origin/cookie/security hacks:
1. `/api/:path*` &rarr; `https://api.florabot.site/api/:path*` (backend API proxy)
2. `/:path*` &rarr; `/index.html` (SPA client-side routing fallback)

### Device Isolation and Preview

- Accessing `?preview=1` launches the catalog and simulator preview completely isolated from physical hardware.
- It never issues physical commands, never triggers cabinet/door unlock, and performs no actual purchases, orders, or test writes.
- Real kiosk operations strictly require explicit runtime device provisioning (UUID and device key). Without provisioning, no physical commands or hardware interactions can occur.
