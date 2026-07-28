import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../../bindings'
import { dashboardAuth } from '../auth/auth.middleware'
import { LogoutPage } from '../auth/logout.view'
import {
  listFiles,
  searchFiles,
  getFile,
  getFileRecord,
  uploadFile,
  deleteFile,
  updateFileMetadata,
  InvalidFileNameError,
  InvalidCategoryError,
  FileNotFoundError,
  type FileCategory,
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

function errorStatus(err: unknown): 400 | 404 | 500 {
  if (err instanceof FileNotFoundError) return 404
  if (err instanceof InvalidFileNameError || err instanceof InvalidCategoryError) return 400
  return 500
}

filesRoutes.get('/', async (c) => {
  const files = await listFiles(c.env.DB, c.env.FILES_BUCKET)
  return c.html(<DashboardPage files={files} />)
})

filesRoutes.get('/search', async (c) => {
  const q = c.req.query('q') ?? ''
  const files = await searchFiles(c.env.DB, c.env.FILES_BUCKET, q)
  return c.html(<FileRows files={files} />)
})

filesRoutes.get('/download/:key', async (c) => {
  const key = c.req.param('key')
  const [record, obj] = await Promise.all([getFileRecord(c.env.DB, key), getFile(c.env.FILES_BUCKET, key)])
  if (!obj) return c.notFound()

  const filename = (record?.displayName ?? key.slice(key.lastIndexOf('/') + 1)).replace(/"/g, '')
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

  const category = String(body['category'] ?? '')
  const description = String(body['description'] ?? '')

  try {
    await uploadFile(c.env.DB, c.env.FILES_BUCKET, file, {
      category,
      description,
      uploadedBy: c.env.DASHBOARD_USERNAME,
    })
  } catch (err) {
    return c.text(err instanceof Error ? err.message : 'Gagal mengunggah file', errorStatus(err))
  }

  const files = await listFiles(c.env.DB, c.env.FILES_BUCKET)
  return c.html(<FileRows files={files} />)
})

filesRoutes.get('/files/:key/edit', async (c) => {
  const key = c.req.param('key')
  const file = await getFileRecord(c.env.DB, key)
  if (!file) return c.notFound()
  return c.html(<FileEditRow file={file} />)
})

filesRoutes.get('/files/:key', async (c) => {
  const key = c.req.param('key')
  const file = await getFileRecord(c.env.DB, key)
  if (!file) return c.notFound()
  return c.html(<FileRow file={file} />)
})

filesRoutes.put('/files/:key', requireHtmx, async (c) => {
  const key = c.req.param('key')
  const body = await c.req.parseBody()
  const displayName = String(body['displayName'] ?? '')
  const category = String(body['category'] ?? '')
  const description = String(body['description'] ?? '')

  try {
    const updated = await updateFileMetadata(c.env.DB, key, { displayName, category, description })
    return c.html(<FileRow file={updated} />)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan perubahan'
    // Validation errors re-render the edit row with the message. The client
    // forces htmx to swap PUT responses regardless of status (see the
    // beforeSwap listener in files.view.tsx) so this actually renders.
    if (err instanceof InvalidFileNameError || err instanceof InvalidCategoryError) {
      const fallback = {
        storageKey: key,
        displayName,
        category: category as FileCategory,
        description,
        uploadedAt: '',
        uploadedBy: null,
      }
      return c.html(<FileEditRow file={fallback} error={message} />, 400)
    }
    return c.text(message, errorStatus(err))
  }
})

filesRoutes.delete('/files/:key', requireHtmx, async (c) => {
  const key = c.req.param('key')
  try {
    await deleteFile(c.env.DB, c.env.FILES_BUCKET, key)
  } catch (err) {
    return c.text(err instanceof Error ? err.message : 'Gagal menghapus file', 500)
  }
  return c.html('')
})

filesRoutes.get('/logout', (c) => {
  c.header('WWW-Authenticate', 'Basic realm="Secure Area"')
  return c.html(<LogoutPage />, 401)
})
