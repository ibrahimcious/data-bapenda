import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import {
  InvalidCategoryError,
  InvalidFileNameError,
  FileNotFoundError,
  deleteFile,
  getFileRecord,
  listFiles,
  searchFiles,
  syncMissingFileRecords,
  updateFileMetadata,
  uploadFile,
} from '../src/modules/files/files.service'

function makeFile(name: string, content = 'hello'): File {
  return new File([content], name)
}

describe('uploadFile / listFiles / searchFiles', () => {
  it('uploads a file and lists it with the fields it was uploaded with', async () => {
    const record = await uploadFile(env.DB, env.FILES_BUCKET, makeFile('new-file.txt'), {
      category: 'Lainnya',
      description: 'a test file',
      uploadedBy: 'tester',
    })

    expect(record.displayName).toBe('new-file.txt')
    expect(record.category).toBe('Lainnya')
    expect(record.description).toBe('a test file')
    expect(record.uploadedBy).toBe('tester')
    expect(await env.FILES_BUCKET.get(record.storageKey)).not.toBeNull()

    const files = await listFiles(env.DB, env.FILES_BUCKET)
    expect(files.map((f) => f.storageKey)).toContain(record.storageKey)
  })

  it('generates a storage_key independent of the display name, so two files can share a display name', async () => {
    const a = await uploadFile(env.DB, env.FILES_BUCKET, makeFile('dup.txt'), { category: 'Lainnya' })
    const b = await uploadFile(env.DB, env.FILES_BUCKET, makeFile('dup.txt'), { category: 'Lainnya' })

    expect(a.storageKey).not.toBe(b.storageKey)
    expect(a.displayName).toBe('dup.txt')
    expect(b.displayName).toBe('dup.txt')
  })

  it('rejects an empty file name', async () => {
    await expect(
      uploadFile(env.DB, env.FILES_BUCKET, makeFile('   '), { category: 'Lainnya' }),
    ).rejects.toThrow(InvalidFileNameError)
  })

  it('rejects a category outside the fixed list', async () => {
    await expect(
      uploadFile(env.DB, env.FILES_BUCKET, makeFile('a.txt'), { category: 'Not A Real Category' }),
    ).rejects.toThrow(InvalidCategoryError)
  })

  it('rejects "Uncategorized" as an upload-time category', async () => {
    await expect(
      uploadFile(env.DB, env.FILES_BUCKET, makeFile('a.txt'), { category: 'Uncategorized' }),
    ).rejects.toThrow(InvalidCategoryError)
  })

  it('search matches by display name, category, or description', async () => {
    const record = await uploadFile(env.DB, env.FILES_BUCKET, makeFile('Report-2026.pdf'), {
      category: 'Laporan Potensi Pajak',
      description: 'quarterly tax potential summary',
    })

    expect((await searchFiles(env.DB, env.FILES_BUCKET, 'report')).map((f) => f.storageKey)).toContain(
      record.storageKey,
    )
    expect((await searchFiles(env.DB, env.FILES_BUCKET, 'Laporan Potensi')).map((f) => f.storageKey)).toContain(
      record.storageKey,
    )
    expect((await searchFiles(env.DB, env.FILES_BUCKET, 'quarterly tax')).map((f) => f.storageKey)).toContain(
      record.storageKey,
    )
  })

  it('search with a blank query returns everything', async () => {
    const record = await uploadFile(env.DB, env.FILES_BUCKET, makeFile('anything.txt'), { category: 'Lainnya' })
    const results = await searchFiles(env.DB, env.FILES_BUCKET, '   ')
    expect(results.map((f) => f.storageKey)).toContain(record.storageKey)
  })
})

describe('syncMissingFileRecords / backfill', () => {
  it('backfills an R2 object with no matching D1 row as Uncategorized', async () => {
    await env.FILES_BUCKET.put('orphaned/legacy-file.pdf', 'x')

    const files = await listFiles(env.DB, env.FILES_BUCKET)
    const backfilled = files.find((f) => f.storageKey === 'orphaned/legacy-file.pdf')

    expect(backfilled).toBeDefined()
    expect(backfilled?.displayName).toBe('legacy-file.pdf')
    expect(backfilled?.category).toBe('Uncategorized')
  })

  it('ignores folder marker keys', async () => {
    await env.FILES_BUCKET.put('folder/', '')
    await syncMissingFileRecords(env.DB, env.FILES_BUCKET)

    const record = await getFileRecord(env.DB, 'folder/')
    expect(record).toBeNull()
  })

  it('is idempotent — running twice does not duplicate rows', async () => {
    await env.FILES_BUCKET.put('idempotent-test.txt', 'x')
    await syncMissingFileRecords(env.DB, env.FILES_BUCKET)
    await syncMissingFileRecords(env.DB, env.FILES_BUCKET)

    const files = await listFiles(env.DB, env.FILES_BUCKET)
    expect(files.filter((f) => f.storageKey === 'idempotent-test.txt')).toHaveLength(1)
  })
})

describe('updateFileMetadata', () => {
  it('updates display name, category, and description without touching the R2 object', async () => {
    const uploaded = await uploadFile(env.DB, env.FILES_BUCKET, makeFile('before.txt'), { category: 'Lainnya' })
    const objectBefore = await env.FILES_BUCKET.head(uploaded.storageKey)

    const updated = await updateFileMetadata(env.DB, uploaded.storageKey, {
      displayName: 'After.txt',
      category: 'Data Kendaraan',
      description: 'now described',
    })

    expect(updated.storageKey).toBe(uploaded.storageKey)
    expect(updated.displayName).toBe('After.txt')
    expect(updated.category).toBe('Data Kendaraan')
    expect(updated.description).toBe('now described')

    const objectAfter = await env.FILES_BUCKET.head(uploaded.storageKey)
    expect(objectAfter?.etag).toBe(objectBefore?.etag)
  })

  it('allows saving with category still Uncategorized', async () => {
    await env.FILES_BUCKET.put('needs-review.txt', 'x')
    await syncMissingFileRecords(env.DB, env.FILES_BUCKET)

    const updated = await updateFileMetadata(env.DB, 'needs-review.txt', {
      displayName: 'Needs Review.txt',
      category: 'Uncategorized',
    })
    expect(updated.category).toBe('Uncategorized')
  })

  it('rejects an empty display name', async () => {
    const uploaded = await uploadFile(env.DB, env.FILES_BUCKET, makeFile('a.txt'), { category: 'Lainnya' })
    await expect(
      updateFileMetadata(env.DB, uploaded.storageKey, { displayName: '   ', category: 'Lainnya' }),
    ).rejects.toThrow(InvalidFileNameError)
  })

  it('throws FileNotFoundError for a storage key with no record', async () => {
    await expect(
      updateFileMetadata(env.DB, 'missing-key.txt', { displayName: 'x', category: 'Lainnya' }),
    ).rejects.toThrow(FileNotFoundError)
  })
})

describe('deleteFile', () => {
  it('deletes both the R2 object and the D1 record', async () => {
    const uploaded = await uploadFile(env.DB, env.FILES_BUCKET, makeFile('to-delete.txt'), { category: 'Lainnya' })
    await deleteFile(env.DB, env.FILES_BUCKET, uploaded.storageKey)

    expect(await env.FILES_BUCKET.get(uploaded.storageKey)).toBeNull()
    expect(await getFileRecord(env.DB, uploaded.storageKey)).toBeNull()
  })
})
