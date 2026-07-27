import type { FC } from 'hono/jsx'
import { Layout } from '../../shared/layout'

export const LogoutPage: FC = () => (
  <Layout title="Logout - Bapenda File Portal" metaRefresh="1;url=/">
    <main class="container landing">
      <article style={{ maxWidth: '420px' }}>
        <h1>Anda telah logout</h1>
        <p>Mengalihkan ke beranda...</p>
        <a href="/">Kembali sekarang</a>
      </article>
    </main>
  </Layout>
)
