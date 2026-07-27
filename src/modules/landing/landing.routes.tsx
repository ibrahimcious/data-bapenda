import { Hono } from 'hono'
import type { Bindings } from '../../bindings'
import { LandingPage } from './landing.view'

export const landingRoutes = new Hono<{ Bindings: Bindings }>()

landingRoutes.get('/', (c) => c.html(<LandingPage />))
