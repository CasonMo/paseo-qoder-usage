# paseo-qoder-usage

Paseo plugin: Qoder account quota (Credits) in the sidebar plus a detail screen with configurable auto refresh.

- Sidebar footer row: Plan Credits and Org Resource Package summaries
- Screen: plan info, credits progress bars with 80%/95% warning colors, quota-exceeded notice, manual refresh
- Auto refresh: off / 5m / 15m / 30m / 1h / 6h / 24h

## Development

- `npm run typecheck`
- `npm run build:sdk-runtime` regenerates `server/sdk-runtime.generated.ts` after `sdk-runtime/package.json` or `sdk-runtime/package-lock.json` change.

## Structure

- `index.client.tsx` / `index.server.ts`: plugin entries
- `client/`: sidebar row and quota screen
- `server/quota.ts`: locked SDK runtime setup and quota fetch
- `server/service.ts`: cache, auto-refresh scheduling, RPC handlers
- `sdk-runtime/`: locked runtime manifest and lockfile used by `npm ci`
