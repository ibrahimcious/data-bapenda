# Bapenda File Portal

A small Cloudflare Workers app (Hono + htmx + Pico CSS) for browsing,
uploading, renaming, and deleting files in an R2 bucket, behind a
Basic-Auth-protected dashboard.

## Setup

```txt
npm install
```

Create `.dev.vars` for local development:

```txt
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<your local password>
```

```txt
npm run dev
```

## Testing

```txt
npm test
```

Runs against the real Workers runtime via `@cloudflare/vitest-pool-workers`
(isolated per-test storage, not mocks).

## Deploying

```txt
npm run deploy
```

Production secrets must be set once via Wrangler (not via `.dev.vars`):

```txt
npx wrangler secret put DASHBOARD_USERNAME
npx wrangler secret put DASHBOARD_PASSWORD
```

## Types

[Regenerate Cloudflare runtime types](https://developers.cloudflare.com/workers/wrangler/commands/#types)
after changing `wrangler.jsonc` (used by `test/tsconfig.json`, gitignored):

```txt
npm run cf-typegen
```
