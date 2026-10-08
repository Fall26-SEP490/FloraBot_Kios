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
The workspace deployment still uses the old FE kiosk path until the migration switches it.
