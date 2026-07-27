import type { FC } from 'hono/jsx'
import { Layout } from '../../shared/layout'
import { baseName, type FileEntry } from './files.service'

export const FileRow: FC<{ file: FileEntry }> = ({ file }) => (
  <tr>
    <td>{file.key}</td>
    <td>
      <a href={`/dashboard/download/${encodeURIComponent(file.key)}`} role="button" class="outline">
        Download
      </a>
    </td>
    <td class="actions">
      <button
        class="outline"
        hx-get={`/dashboard/files/${encodeURIComponent(file.key)}/edit`}
        hx-target="closest tr"
        hx-swap="outerHTML"
      >
        Edit
      </button>
      <button
        class="outline contrast"
        hx-delete={`/dashboard/files/${encodeURIComponent(file.key)}`}
        hx-target="closest tr"
        hx-swap="outerHTML"
        hx-confirm={`Hapus ${file.key}?`}
      >
        Delete
      </button>
    </td>
  </tr>
)

export const FileEditRow: FC<{ file: FileEntry; error?: string }> = ({ file, error }) => (
  <tr>
    <td colspan={2}>
      <form
        hx-put={`/dashboard/files/${encodeURIComponent(file.key)}`}
        hx-target="closest tr"
        hx-swap="outerHTML"
        style={{ display: 'flex', flexDirection: 'column', gap: '.25rem', margin: 0 }}
      >
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input type="text" name="name" value={baseName(file.key)} required autofocus style={{ margin: 0 }} />
          <button type="submit" style={{ width: 'auto' }}>
            Save
          </button>
        </div>
        {error && <small style={{ color: 'var(--pico-del-color)' }}>{error}</small>}
      </form>
    </td>
    <td>
      <button
        class="outline"
        hx-get={`/dashboard/files/${encodeURIComponent(file.key)}`}
        hx-target="closest tr"
        hx-swap="outerHTML"
      >
        Cancel
      </button>
    </td>
  </tr>
)

export const FileRows: FC<{ files: FileEntry[] }> = ({ files }) => (
  <>
    {files.map((file) => (
      <FileRow file={file} />
    ))}
  </>
)

const Sidebar: FC = () => (
  <aside class="sidebar">
    <h3>Bapenda</h3>
    <nav>
      <ul>
        <li>
          <a href="/dashboard">Home</a>
        </li>
        <li>
          <a href="#" onclick="document.getElementById('upload-modal').showModal(); return false;">
            Upload
          </a>
        </li>
        <li>
          <a href="/dashboard/logout" onclick="bapendaLogout(event); return false;">
            Logout
          </a>
        </li>
      </ul>
    </nav>
  </aside>
)

const UploadModal: FC = () => (
  <dialog id="upload-modal">
    <article>
      <header>
        <button aria-label="Close" rel="prev" onclick="document.getElementById('upload-modal').close()"></button>
        <strong>Upload File</strong>
      </header>
      <form
        id="upload-form"
        hx-post="/dashboard/upload"
        hx-target="#file-rows"
        hx-swap="innerHTML"
        hx-encoding="multipart/form-data"
      >
        <input type="file" name="file" required />
        <button type="submit">Upload</button>
        <p id="upload-error" hidden style={{ color: 'var(--pico-del-color)' }}></p>
      </form>
    </article>
  </dialog>
)

const closeModalOnUploadScript = `
document.body.addEventListener('htmx:afterRequest', function (evt) {
  if (evt.detail.elt && evt.detail.elt.id === 'upload-form' && evt.detail.successful) {
    evt.detail.elt.reset()
    document.getElementById('upload-error').hidden = true
    document.getElementById('upload-modal').close()
  }
})

// htmx doesn't swap non-2xx responses into hx-target by default (so a
// rejected upload can't clobber the whole file table) — show the server's
// error message next to the form instead.
document.body.addEventListener('htmx:responseError', function (evt) {
  if (evt.detail.elt && evt.detail.elt.id === 'upload-form') {
    var errorEl = document.getElementById('upload-error')
    errorEl.textContent = evt.detail.xhr.responseText || 'Gagal mengunggah file'
    errorEl.hidden = false
  }
})

// The rename form (PUT) returns a proper 400/409 with the edit row
// re-rendered to show the validation/collision message, but htmx's default
// is to not swap non-2xx responses at all. Force it to swap for PUT
// specifically — upload/delete keep the safer default so a failed request
// there can't blank out the table or vanish a row that's still present.
document.body.addEventListener('htmx:beforeSwap', function (evt) {
  if (evt.detail.requestConfig && evt.detail.requestConfig.verb === 'put') {
    evt.detail.shouldSwap = true
    evt.detail.isError = false
  }
})

// A plain navigation to a URL that replies 401 makes the browser pop its
// native Basic Auth dialog and block on it instead of rendering the page.
// Doing the request in the background (with deliberately wrong credentials,
// which the browser won't prompt for since they're supplied programmatically)
// avoids that popup, and we redirect ourselves once it settles.
function bapendaLogout(event) {
  event.preventDefault()
  var xhr = new XMLHttpRequest()
  xhr.open('GET', '/dashboard/logout', true, 'logout', 'logout')
  xhr.onloadend = function () {
    window.location.href = '/'
  }
  xhr.send()
}
`

const footerLines = [
  'Backup itu penting, jangan cuma janji.',
  'Rapi itu nomor satu, file berantakan nomor buncit.',
  'Upload, unduh, hapus — semua dalam satu klik.',
  'Ditenagai oleh Cloudflare R2 dan sedikit keajaiban.',
  'Dibuat dengan htmx, Pico CSS, dan kopi.',
  'Satu bucket, sejuta berkas.',
]

const Footer: FC = () => (
  <footer class="dashboard-footer">
    <small>{footerLines[Math.floor(Math.random() * footerLines.length)]}</small>
  </footer>
)

export const DashboardPage: FC<{ files: FileEntry[] }> = ({ files }) => (
  <Layout title="Dashboard - Bapenda File Portal">
    <div class="dashboard">
      <div class="dashboard-body">
        <Sidebar />
        <main>
          <h1>Daftar File</h1>
          <div class="toolbar">
            <input
              type="search"
              name="q"
              placeholder="Cari nama file..."
              hx-get="/dashboard/search"
              hx-trigger="input changed delay:300ms, search"
              hx-target="#file-rows"
              hx-swap="innerHTML"
            />
          </div>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Unduh</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="file-rows">
              <FileRows files={files} />
            </tbody>
          </table>
        </main>
      </div>
      <Footer />
      <UploadModal />
      <script dangerouslySetInnerHTML={{ __html: closeModalOnUploadScript }}></script>
    </div>
  </Layout>
)
