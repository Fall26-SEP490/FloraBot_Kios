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

When no device is provisioned, the app opens the preview. `?preview=1` explicitly opens it even if a device session exists; `?setup=1` opens device setup. The preview includes flower selection, basket/message, payment layout and pickup screens. Sample photos/prices are labelled, and all transitions stay in memory. It never creates an order/payment, sends a device command, uses a device key or claims a physical pickup. Enter `DEMO2026` to view the final screen.

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
