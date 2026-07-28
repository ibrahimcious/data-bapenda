import { applyD1Migrations, env } from 'cloudflare:test'

// TEST_MIGRATIONS is injected via miniflare bindings in vitest.config.ts, not
// declared in wrangler.jsonc, so it isn't part of the generated Env type.
await applyD1Migrations(env.DB, (env as unknown as { TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1] }).TEST_MIGRATIONS)
