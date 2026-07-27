import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../../bindings'
import { dashboardAuth } from '../auth/auth.middleware'
import { LogoutPage } from '../auth/logout.view'
import {
  listFiles,
  searchFiles,
  getFile,
  uploadFile,
  deleteFile,
  renameFile,
  InvalidFileNameError,
  FileExistsError,
  FileNotFoundError,
} from './files.service'
import { DashboardPage, FileRow, FileEditRow, FileRows } from './files.view'

export const filesRoutes = new Hono<{ Bindings: Bindings }>()

filesRoutes.use('*', dashboardAuth)

// Basic Auth credentials are auto-attached by the browser to any same-origin
// request, including one triggered by a hidden auto-submitting <form> on a
// hostile third-party page. htmx sets this header on every request it
// issues; a plain cross-site <form> POST can't set custom headers, so
// requiring it blocks that CSRF path without needing session/token
// infrastructure.
const requireHtmx: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  if (c.req.header('HX-Request') !== 'true') {
    return c.text('Forbidden', 403)
  }
  await next()
}

function errorStatus(err: unknown): 404 | 409 | 500 {
  if (err instanceof FileNotFoundError) return 404
  if (err instanceof FileExistsError) return 409
  return 500
}

filesRoutes.get('/', async (c) => {
  const files = await listFiles(c.env.FILES_BUCKET)
  return c.html(<DashboardPage files={files} />)
})

filesRoutes.get('/search', async (c) => {
  const q = c.req.query('q') ?? ''
  const files = await searchFiles(c.env.FILES_BUCKET, q)
  return c.html(<FileRows files={files} />)
})

filesRoutes.get('/download/:key', async (c) => {
  const key = c.req.param('key')
  const obj = await getFile(c.env.FILES_BUCKET, key)
  if (!obj) return c.notFound()

  const filename = key.slice(key.lastIndexOf('/') + 1).replace(/"/g, '')
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      // Forces a download instead of rendering inline — otherwise an
      // uploaded .html/.svg would execute in the browser as stored XSS.
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

filesRoutes.post('/upload', requireHtmx, async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  if (!(file instanceof File) || file.size === 0) {
    return c.text('Tidak ada file yang diunggah', 400)
  }

  try {
    await uploadFile(c.env.FILES_BUCKET, file)
  } catch (err) {
    const status = err instanceof InvalidFileNameError ? 400 : errorStatus(err)
    return c.text(err instanceof Error ? err.message : 'Gagal mengunggah file', status)
  }

  const files = await listFiles(c.env.FILES_BUCKET)
  return c.html(<FileRows files={files} />)
})

filesRoutes.get('/files/:key/edit', (c) => {
  const key = c.req.param('key')
  return c.html(<FileEditRow file={{ key }} />)
})

filesRoutes.get('/files/:key', (c) => {
  const key = c.req.param('key')
  return c.html(<FileRow file={{ key }} />)
})

filesRoutes.put('/files/:key', requireHtmx, async (c) => {
  const key = c.req.param('key')
  const body = await c.req.parseBody()
  const newName = String(body['name'] ?? '').trim()
  if (!newName) {
    return c.html(<FileEditRow file={{ key }} error="Nama file tidak boleh kosong" />, 400)
  }

  try {
    const renamed = await renameFile(c.env.FILES_BUCKET, key, newName)
    return c.html(<FileRow file={renamed} />)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengganti nama file'
    // Validation/collision errors re-render the edit row with the message.
    // The client forces htmx to swap PUT responses regardless of status (see
    // the beforeSwap listener in files.view.tsx) so this actually renders.
    if (err instanceof InvalidFileNameError || err instanceof FileExistsError) {
      return c.html(<FileEditRow file={{ key }} error={message} />, err instanceof FileExistsError ? 409 : 400)
    }
    return c.text(message, errorStatus(err))
  }
})

filesRoutes.delete('/files/:key', requireHtmx, async (c) => {
  const key = c.req.param('key')
  try {
    await deleteFile(c.env.FILES_BUCKET, key)
  } catch (err) {
    return c.text(err instanceof Error ? err.message : 'Gagal menghapus file', 500)
  }
  return c.html('')
})

filesRoutes.get('/logout', (c) => {
  c.header('WWW-Authenticate', 'Basic realm="Secure Area"')
  return c.html(<LogoutPage />, 401)
})
