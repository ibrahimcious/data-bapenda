import { raw } from 'hono/html'
import type { FC, PropsWithChildren } from 'hono/jsx'

export const Layout: FC<PropsWithChildren<{ title?: string; metaRefresh?: string }>> = ({
  title = 'Bapenda File Portal',
  metaRefresh,
  children,
}) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="id" data-theme="light">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {metaRefresh && <meta http-equiv="refresh" content={metaRefresh} />}
        <title>{title}</title>
        <link rel="stylesheet" href="/assets/pico.min.css" />
        <link rel="stylesheet" href="/assets/app.css" />
        <script src="/assets/htmx.min.js"></script>
      </head>
      <body>{children}</body>
    </html>
  </>
)
