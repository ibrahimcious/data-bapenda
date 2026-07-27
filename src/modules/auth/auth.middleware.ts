import { basicAuth } from 'hono/basic-auth'
import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../../bindings'

export const dashboardAuth: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  const auth = basicAuth({
    username: c.env.DASHBOARD_USERNAME,
    password: c.env.DASHBOARD_PASSWORD,
  })
  return auth(c, next)
}
