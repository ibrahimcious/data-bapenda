import type { FC } from 'hono/jsx'
import { Layout } from '../../shared/layout'

const loginScript = `
document.getElementById('login-form').addEventListener('submit', function (e) {
  e.preventDefault()
  var form = this
  var button = form.querySelector('button[type="submit"]')
  var errorEl = document.getElementById('login-error')
  errorEl.hidden = true
  button.setAttribute('aria-busy', 'true')
  button.disabled = true

  // XHR's user/password args make the browser cache the credentials against
  // this origin's auth realm (a plain fetch() with a manual Authorization
  // header does NOT get cached), so the next navigation to /dashboard
  // doesn't trigger the native Basic Auth popup.
  var xhr = new XMLHttpRequest()
  xhr.open('GET', '/dashboard', true, form.username.value, form.password.value)
  xhr.onload = function () {
    if (xhr.status === 200) {
      window.location.href = '/dashboard'
      return
    }
    errorEl.hidden = false
    button.removeAttribute('aria-busy')
    button.disabled = false
  }
  xhr.onerror = function () {
    errorEl.hidden = false
    button.removeAttribute('aria-busy')
    button.disabled = false
  }
  xhr.send()
})
`

export const LandingPage: FC = () => (
  <Layout title="Bapenda File Portal">
    <main class="container landing">
      <article style={{ maxWidth: '380px', width: '100%' }}>
        <hgroup>
          <h1>Bapenda File Portal</h1>
          <p>Simpan dan kelola dokumen Bapenda dalam satu tempat.</p>
        </hgroup>
        <form id="login-form">
          <label>
            Username
            <input type="text" name="username" autocomplete="username" required autofocus />
          </label>
          <label>
            Password
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <button type="submit">Login</button>
          <p id="login-error" hidden style={{ color: 'var(--pico-del-color)' }}>
            Username atau password salah.
          </p>
        </form>
      </article>
      <script dangerouslySetInnerHTML={{ __html: loginScript }}></script>
    </main>
  </Layout>
)
