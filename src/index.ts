import { Hono } from 'hono'
import type { Bindings } from './bindings'
import { landingRoutes } from './modules/landing/landing.routes'
import { filesRoutes } from './modules/files/files.routes'

const app = new Hono<{ Bindings: Bindings }>()

app.route('/', landingRoutes)
app.route('/dashboard', filesRoutes)

export default app
