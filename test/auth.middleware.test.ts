import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { Bindings } from '../src/bindings'
import { dashboardAuth } from '../src/modules/auth/auth.middleware'

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', dashboardAuth)
  app.get('/', (c) => c.text('ok'))
  return app
}

function basicAuthHeader(username: string, password: string) {
  return 'Basic ' + btoa(`${username}:${password}`)
}

describe('dashboardAuth', () => {
  it('rejects requests with no credentials', async () => {
    const res = await buildApp().request('/', {}, env)
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toContain('Basic')
  })

  it('rejects requests with the wrong password', async () => {
    const res = await buildApp().request(
      '/',
      { headers: { Authorization: basicAuthHeader(env.DASHBOARD_USERNAME, 'definitely-wrong') } },
      env,
    )
    expect(res.status).toBe(401)
  })

  it('rejects requests with the wrong username', async () => {
    const res = await buildApp().request(
      '/',
      { headers: { Authorization: basicAuthHeader('not-the-admin', env.DASHBOARD_PASSWORD) } },
      env,
    )
    expect(res.status).toBe(401)
  })

  it('accepts requests with the correct credentials', async () => {
    const res = await buildApp().request(
      '/',
      { headers: { Authorization: basicAuthHeader(env.DASHBOARD_USERNAME, env.DASHBOARD_PASSWORD) } },
      env,
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
