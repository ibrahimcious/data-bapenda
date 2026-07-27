import { basicAuth } from 'hono/basic-auth'
import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../../bindings'

export const dashboardAuth: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  // A 401 + WWW-Authenticate on a plain navigation makes the browser pop its
  // native Basic Auth dialog instead of rendering our login page, so a bare
  // navigation with no credentials gets sent to the custom login page
  // instead. But the landing page's login XHR *also* starts with no
  // Authorization header on purpose — it relies on getting that same 401
  // challenge back so the browser auto-retries with the credentials it was
  // given. Sec-Fetch-Mode distinguishes the two: browsers set it to
  // 'navigate' only for real page loads, never for XHR/fetch, so only
  // navigations get redirected; the login XHR still reaches basicAuth below.
  if (c.req.header('Sec-Fetch-Mode') === 'navigate' && !c.req.header('Authorization')) {
    return c.redirect('/')
  }

  const auth = basicAuth({
    username: c.env.DASHBOARD_USERNAME,
    password: c.env.DASHBOARD_PASSWORD,
  })
  return auth(c, next)
}
