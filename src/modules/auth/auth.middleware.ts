import { basicAuth } from 'hono/basic-auth'
import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../../bindings'

export const dashboardAuth: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  // A 401 + WWW-Authenticate on a plain navigation makes the browser pop its
  // native Basic Auth dialog instead of rendering our login page. Only send
  // that challenge to requests that already carry credentials (the landing
  // page's XHR-based login, or a browser that cached them from a prior
  // request); a bare navigation with no header gets sent to the custom
  // login page instead.
  if (!c.req.header('Authorization')) {
    return c.redirect('/')
  }

  const auth = basicAuth({
    username: c.env.DASHBOARD_USERNAME,
    password: c.env.DASHBOARD_PASSWORD,
  })
  return auth(c, next)
}
