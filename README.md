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
