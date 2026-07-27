import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import {
  FileExistsError,
  FileNotFoundError,
  InvalidFileNameError,
  deleteFile,
  listFiles,
  renameFile,
  searchFiles,
  uploadFile,
} from '../src/modules/files/files.service'

function makeFile(name: string, content = 'hello'): File {
  return new File([content], name)
}

describe('listFiles / searchFiles', () => {
  it('lists uploaded files and filters out folder markers', async () => {
    await env.FILES_BUCKET.put('a.txt', 'a')
    await env.FILES_BUCKET.put('folder/', '')

    const files = await listFiles(env.FILES_BUCKET)
    const keys = files.map((f) => f.key)

    expect(keys).toContain('a.txt')
    expect(keys).not.toContain('folder/')
  })

  it('returns every uploaded file (exercises the truncated/cursor loop)', async () => {
    // Miniflare's R2 simulator doesn't actually cap list() at 1000 objects,
    // so this can't force a real multi-page response — it just confirms the
    // loop still returns everything when it only takes one page.
    for (let i = 0; i < 5; i++) {
      await env.FILES_BUCKET.put(`page-test-${i}.txt`, 'x')
    }

    const keys = (await listFiles(env.FILES_BUCKET)).map((f) => f.key)
    for (let i = 0; i < 5; i++) {
      expect(keys).toContain(`page-test-${i}.txt`)
    }
  })

  it('search filters case-insensitively by substring', async () => {
    await env.FILES_BUCKET.put('Report-2026.pdf', 'x')
    const results = await searchFiles(env.FILES_BUCKET, 'report')
    expect(results.map((f) => f.key)).toContain('Report-2026.pdf')
  })

  it('search with a blank query returns everything', async () => {
    await env.FILES_BUCKET.put('anything.txt', 'x')
    const results = await searchFiles(env.FILES_BUCKET, '   ')
    expect(results.map((f) => f.key)).toContain('anything.txt')
  })
})

describe('uploadFile', () => {
  it('uploads a file under its own name', async () => {
    await uploadFile(env.FILES_BUCKET, makeFile('new-file.txt'))
    expect(await env.FILES_BUCKET.get('new-file.txt')).not.toBeNull()
  })

  it('rejects an empty file name', async () => {
    await expect(uploadFile(env.FILES_BUCKET, makeFile('   '))).rejects.toThrow(InvalidFileNameError)
  })

  it('rejects path-traversal-style file names', async () => {
    await expect(uploadFile(env.FILES_BUCKET, makeFile('../evil.txt'))).rejects.toThrow(InvalidFileNameError)
  })

  it('rejects uploading over an existing key', async () => {
    await env.FILES_BUCKET.put('dup.txt', 'first')
    await expect(uploadFile(env.FILES_BUCKET, makeFile('dup.txt'))).rejects.toThrow(FileExistsError)
  })
})

describe('renameFile', () => {
  it('renames a file, preserving its directory prefix', async () => {
    await env.FILES_BUCKET.put('docs/original.txt', 'content')
    const renamed = await renameFile(env.FILES_BUCKET, 'docs/original.txt', 'renamed.txt')

    expect(renamed.key).toBe('docs/renamed.txt')
    expect(await env.FILES_BUCKET.get('docs/original.txt')).toBeNull()
    expect(await env.FILES_BUCKET.get('docs/renamed.txt')).not.toBeNull()
  })

  it('rejects renaming onto an existing file, leaving both untouched', async () => {
    await env.FILES_BUCKET.put('one.txt', 'one')
    await env.FILES_BUCKET.put('two.txt', 'two')

    await expect(renameFile(env.FILES_BUCKET, 'one.txt', 'two.txt')).rejects.toThrow(FileExistsError)
    expect(await env.FILES_BUCKET.get('one.txt')).not.toBeNull()
    expect(await env.FILES_BUCKET.get('two.txt')).not.toBeNull()
  })

  it('throws FileNotFoundError when the source key does not exist', async () => {
    await expect(renameFile(env.FILES_BUCKET, 'missing.txt', 'new-name.txt')).rejects.toThrow(FileNotFoundError)
  })

  it('is a no-op when the new name matches the current name', async () => {
    await env.FILES_BUCKET.put('same.txt', 'x')
    const result = await renameFile(env.FILES_BUCKET, 'same.txt', 'same.txt')
    expect(result.key).toBe('same.txt')
  })
})

describe('deleteFile', () => {
  it('deletes an existing file', async () => {
    await env.FILES_BUCKET.put('to-delete.txt', 'x')
    await deleteFile(env.FILES_BUCKET, 'to-delete.txt')
    expect(await env.FILES_BUCKET.get('to-delete.txt')).toBeNull()
  })
})
