import type { FC } from 'hono/jsx'
import { Layout } from '../../shared/layout'

const loginScript = `
document.addEventListener('alpine:init', () => {
  Alpine.data('login', () => ({
    username: '',
    password: '',
    submitting: false,
    error: false,

    submit() {
      this.error = false
      this.submitting = true

      // XHR's user/password args make the browser cache the credentials against
      // this origin's auth realm (a plain fetch() with a manual Authorization
      // header does NOT get cached), so the next navigation to /dashboard
      // doesn't trigger the native Basic Auth popup.
      var xhr = new XMLHttpRequest()
      xhr.open('GET', '/dashboard', true, this.username, this.password)
      xhr.onload = () => {
        if (xhr.status === 200) {
          window.location.href = '/dashboard'
          return
        }
        this.error = true
        this.submitting = false
      }
      xhr.onerror = () => {
        this.error = true
        this.submitting = false
      }
      xhr.send()
    },
  }))
})
`

export const LandingPage: FC = () => (
  <Layout title="Bapenda File Portal">
    <main class="container landing">
      <article style={{ maxWidth: '380px', width: '100%' }} x-data="login">
        <hgroup>
          <h1>Bapenda File Portal</h1>
          <p>Simpan dan kelola dokumen Bapenda dalam satu tempat.</p>
        </hgroup>
        <form {...{ 'x-on:submit.prevent': 'submit' }}>
          <label>
            Username
            <input
              type="text"
              name="username"
              autocomplete="username"
              required
              autofocus
              x-model="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autocomplete="current-password"
              required
              x-model="password"
            />
          </label>
          <button type="submit" x-bind:aria-busy="submitting" x-bind:disabled="submitting">
            Login
          </button>
          <p x-show="error" x-cloak style={{ color: 'var(--pico-del-color)' }}>
            Username atau password salah.
          </p>
        </form>
      </article>
      <script dangerouslySetInnerHTML={{ __html: loginScript }}></script>
    </main>
  </Layout>
)
