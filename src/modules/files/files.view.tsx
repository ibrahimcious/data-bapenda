import type { FC } from 'hono/jsx'
import { Layout } from '../../shared/layout'
import { FILE_CATEGORIES, type FileRecord } from './files.service'

const CategoryBadge: FC<{ category: string }> = ({ category }) =>
  category === 'Uncategorized' ? <mark title="Perlu dikategorikan">{category}</mark> : <span>{category}</span>

export const FileRow: FC<{ file: FileRecord }> = ({ file }) => (
  <tr>
    <td>
      {file.displayName}
      {file.description && (
        <>
          <br />
          <small>{file.description}</small>
        </>
      )}
    </td>
    <td>
      <CategoryBadge category={file.category} />
    </td>
    <td>
      <a href={`/dashboard/download/${encodeURIComponent(file.storageKey)}`} role="button" class="outline">
        Download
      </a>
    </td>
    <td class="actions">
      <button
        class="outline"
        hx-get={`/dashboard/files/${encodeURIComponent(file.storageKey)}/edit`}
        hx-target="closest tr"
        hx-swap="outerHTML"
      >
        Edit
      </button>
      <button
        class="outline contrast"
        hx-delete={`/dashboard/files/${encodeURIComponent(file.storageKey)}`}
        hx-target="closest tr"
        hx-swap="outerHTML"
        hx-confirm={`Hapus ${file.displayName}?`}
      >
        Delete
      </button>
    </td>
  </tr>
)

export const FileEditRow: FC<{ file: FileRecord; error?: string }> = ({ file, error }) => (
  <tr>
    <td colspan={3}>
      <form
        hx-put={`/dashboard/files/${encodeURIComponent(file.storageKey)}`}
        hx-target="closest tr"
        hx-swap="outerHTML"
        style={{ display: 'flex', flexDirection: 'column', gap: '.25rem', margin: 0 }}
      >
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input type="text" name="displayName" value={file.displayName} required autofocus style={{ margin: 0 }} />
          <select name="category" required style={{ margin: 0, width: 'auto' }}>
            {file.category === 'Uncategorized' && (
              <option value="Uncategorized" selected>
                Uncategorized
              </option>
            )}
            {FILE_CATEGORIES.map((category) => (
              <option value={category} selected={category === file.category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <textarea name="description" placeholder="Deskripsi (opsional)" style={{ margin: 0 }}>
          {file.description ?? ''}
        </textarea>
        <div>
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
        hx-get={`/dashboard/files/${encodeURIComponent(file.storageKey)}`}
        hx-target="closest tr"
        hx-swap="outerHTML"
      >
        Cancel
      </button>
    </td>
  </tr>
)

export const FileRows: FC<{ files: FileRecord[] }> = ({ files }) => (
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
          <a href="#" {...{ 'x-on:click.prevent': '$refs.uploadModal.showModal()' }}>
            Upload
          </a>
        </li>
        <li>
          <a href="/dashboard/logout" {...{ 'x-on:click.prevent': 'logout' }}>
            Logout
          </a>
        </li>
      </ul>
    </nav>
  </aside>
)

const UploadModal: FC = () => (
  <dialog x-ref="uploadModal">
    <article>
      <header>
        <button aria-label="Close" rel="prev" x-on:click="$refs.uploadModal.close()"></button>
        <strong>Upload File</strong>
      </header>
      <form
        id="upload-form"
        hx-post="/dashboard/upload"
        hx-target="#file-rows"
        hx-swap="innerHTML"
        hx-encoding="multipart/form-data"
        {...{
          'x-on:htmx:after-request.camel': 'onUploadAfterRequest($event)',
          'x-on:htmx:response-error.camel': 'onUploadResponseError($event)',
        }}
      >
        <input type="file" name="file" required />
        <select name="category" required>
          <option value="" disabled selected>
            Pilih kategori...
          </option>
          {FILE_CATEGORIES.map((category) => (
            <option value={category}>{category}</option>
          ))}
        </select>
        <textarea name="description" placeholder="Deskripsi (opsional)"></textarea>
        <button type="submit">Upload</button>
        <p x-show="uploadError" x-cloak x-text="uploadError" style={{ color: 'var(--pico-del-color)' }}></p>
      </form>
    </article>
  </dialog>
)

const dashboardScript = `
document.addEventListener('alpine:init', () => {
  Alpine.data('dashboard', () => ({
    uploadError: '',

    onUploadAfterRequest(evt) {
      if (evt.detail.elt && evt.detail.elt.id === 'upload-form' && evt.detail.successful) {
        evt.detail.elt.reset()
        this.uploadError = ''
        this.$refs.uploadModal.close()
      }
    },

    // htmx doesn't swap non-2xx responses into hx-target by default (so a
    // rejected upload can't clobber the whole file table) — show the server's
    // error message next to the form instead.
    onUploadResponseError(evt) {
      if (evt.detail.elt && evt.detail.elt.id === 'upload-form') {
        this.uploadError = evt.detail.xhr.responseText || 'Gagal mengunggah file'
      }
    },

    // A plain navigation to a URL that replies 401 makes the browser pop its
    // native Basic Auth dialog and block on it instead of rendering the page.
    // Doing the request in the background (with deliberately wrong credentials,
    // which the browser won't prompt for since they're supplied programmatically)
    // avoids that popup, and we redirect ourselves once it settles.
    logout() {
      var xhr = new XMLHttpRequest()
      xhr.open('GET', '/dashboard/logout', true, 'logout', 'logout')
      xhr.onloadend = function () {
        window.location.href = '/'
      }
      xhr.send()
    },
  }))
})

// The edit form (PUT) returns a proper 400 with the edit row re-rendered to
// show the validation message, but htmx's default is to not swap non-2xx
// responses at all. Force it to swap for PUT specifically — upload/delete
// keep the safer default so a failed request there can't blank out the table
// or vanish a row that's still present. This is global htmx swap policy, not
// per-component UI state, so it stays as plain htmx event wiring outside the
// Alpine component above.
document.body.addEventListener('htmx:beforeSwap', function (evt) {
  if (evt.detail.requestConfig && evt.detail.requestConfig.verb === 'put') {
    evt.detail.shouldSwap = true
    evt.detail.isError = false
  }
})
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

export const DashboardPage: FC<{ files: FileRecord[] }> = ({ files }) => (
  <Layout title="Dashboard - Bapenda File Portal">
    <div class="dashboard" x-data="dashboard">
      <div class="dashboard-body">
        <Sidebar />
        <main>
          <h1>Daftar File</h1>
          <div class="toolbar">
            <input
              type="search"
              name="q"
              placeholder="Cari nama, kategori, atau deskripsi..."
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
                <th>Kategori</th>
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
      <script dangerouslySetInnerHTML={{ __html: dashboardScript }}></script>
    </div>
  </Layout>
)
