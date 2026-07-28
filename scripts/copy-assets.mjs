import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'public', 'assets')

mkdirSync(outDir, { recursive: true })

const files = [
  ['node_modules/htmx.org/dist/htmx.min.js', 'htmx.min.js'],
  ['node_modules/@picocss/pico/css/pico.min.css', 'pico.min.css'],
  ['node_modules/alpinejs/dist/cdn.min.js', 'alpine.min.js'],
]

for (const [src, dest] of files) {
  copyFileSync(path.join(root, src), path.join(outDir, dest))
}
