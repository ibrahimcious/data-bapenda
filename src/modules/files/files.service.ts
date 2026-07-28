export const FILE_CATEGORIES = ['Regulasi/Perundangan', 'Data Kendaraan', 'Laporan Potensi Pajak', 'Lainnya'] as const
const ALL_CATEGORIES = [...FILE_CATEGORIES, 'Uncategorized'] as const

export type FileCategory = (typeof ALL_CATEGORIES)[number]

export type FileRecord = {
  storageKey: string
  displayName: string
  category: FileCategory
  description: string | null
  uploadedAt: string
  uploadedBy: string | null
}

export class InvalidFileNameError extends Error {}
export class InvalidCategoryError extends Error {}
export class FileNotFoundError extends Error {}

type FileRow = {
  storage_key: string
  display_name: string
  category: string
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

function rowToRecord(row: FileRow): FileRecord {
  return {
    storageKey: row.storage_key,
    displayName: row.display_name,
    category: row.category as FileCategory,
    description: row.description,
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
  }
}

async function listAllObjects(bucket: R2Bucket): Promise<R2Object[]> {
  const objects: R2Object[] = []
  let cursor: string | undefined

  do {
    const result: R2Objects = await bucket.list(cursor ? { cursor } : undefined)
    objects.push(...result.objects)
    cursor = result.truncated ? result.cursor : undefined
  } while (cursor)

  return objects
}

function baseName(key: string): string {
  return key.slice(key.lastIndexOf('/') + 1)
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i)
}

function generateStorageKey(originalName: string): string {
  return `${crypto.randomUUID()}${extensionOf(originalName)}`
}

function validateDisplayName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new InvalidFileNameError('Nama file tidak boleh kosong')
  if (trimmed.length > 255) throw new InvalidFileNameError('Nama file terlalu panjang')
  return trimmed
}

// New uploads must pick a real category — 'Uncategorized' is a migration-only
// sentinel, never a choice a user can assign going forward.
function validateCategoryForUpload(category: string): (typeof FILE_CATEGORIES)[number] {
  if (!(FILE_CATEGORIES as readonly string[]).includes(category)) {
    throw new InvalidCategoryError(`Kategori "${category}" tidak valid`)
  }
  return category as (typeof FILE_CATEGORIES)[number]
}

// Edits may leave a backfilled record as 'Uncategorized' (e.g. editing just
// the description) without forcing categorization in the same step.
function validateCategoryForUpdate(category: string): FileCategory {
  if (!(ALL_CATEGORIES as readonly string[]).includes(category)) {
    throw new InvalidCategoryError(`Kategori "${category}" tidak valid`)
  }
  return category as FileCategory
}

// Inserts a D1 row for any R2 object with no matching record — backfills the
// files that existed before this table did, and self-heals if an object ever
// lands in the bucket outside this app's own upload flow.
export async function syncMissingFileRecords(db: D1Database, bucket: R2Bucket): Promise<void> {
  const objects = (await listAllObjects(bucket)).filter((o) => !o.key.endsWith('/'))
  if (objects.length === 0) return

  const existing = await db.prepare('SELECT storage_key FROM files').all<{ storage_key: string }>()
  const known = new Set(existing.results.map((r) => r.storage_key))
  const missing = objects.filter((o) => !known.has(o.key))
  if (missing.length === 0) return

  const stmt = db.prepare(
    'INSERT INTO files (storage_key, display_name, category, description, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
  )
  await db.batch(missing.map((o) => stmt.bind(o.key, baseName(o.key), 'Uncategorized', null, o.uploaded.toISOString(), null)))
}

export async function listFiles(db: D1Database, bucket: R2Bucket): Promise<FileRecord[]> {
  await syncMissingFileRecords(db, bucket)
  const { results } = await db.prepare('SELECT * FROM files ORDER BY uploaded_at DESC').all<FileRow>()
  return results.map(rowToRecord)
}

export async function searchFiles(db: D1Database, bucket: R2Bucket, query: string): Promise<FileRecord[]> {
  await syncMissingFileRecords(db, bucket)
  const q = query.trim()
  if (!q) {
    const { results } = await db.prepare('SELECT * FROM files ORDER BY uploaded_at DESC').all<FileRow>()
    return results.map(rowToRecord)
  }

  const like = `%${q}%`
  const { results } = await db
    .prepare('SELECT * FROM files WHERE display_name LIKE ?1 OR category LIKE ?1 OR description LIKE ?1 ORDER BY uploaded_at DESC')
    .bind(like)
    .all<FileRow>()
  return results.map(rowToRecord)
}

export async function getFileRecord(db: D1Database, storageKey: string): Promise<FileRecord | null> {
  const row = await db.prepare('SELECT * FROM files WHERE storage_key = ?').bind(storageKey).first<FileRow>()
  return row ? rowToRecord(row) : null
}

export async function getFile(bucket: R2Bucket, storageKey: string) {
  return bucket.get(storageKey)
}

export async function uploadFile(
  db: D1Database,
  bucket: R2Bucket,
  file: File,
  options: { category: string; description?: string; uploadedBy?: string | null },
): Promise<FileRecord> {
  const displayName = validateDisplayName(file.name)
  const category = validateCategoryForUpload(options.category)
  const description = options.description?.trim() || null
  const storageKey = generateStorageKey(file.name)
  const uploadedAt = new Date().toISOString()
  const uploadedBy = options.uploadedBy ?? null

  await bucket.put(storageKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || undefined } })

  await db
    .prepare('INSERT INTO files (storage_key, display_name, category, description, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(storageKey, displayName, category, description, uploadedAt, uploadedBy)
    .run()

  return { storageKey, displayName, category, description, uploadedAt, uploadedBy }
}

export async function updateFileMetadata(
  db: D1Database,
  storageKey: string,
  updates: { displayName: string; category: string; description?: string },
): Promise<FileRecord> {
  const existing = await getFileRecord(db, storageKey)
  if (!existing) throw new FileNotFoundError('File tidak ditemukan')

  const displayName = validateDisplayName(updates.displayName)
  const category = validateCategoryForUpdate(updates.category)
  const description = updates.description?.trim() || null

  await db
    .prepare('UPDATE files SET display_name = ?, category = ?, description = ? WHERE storage_key = ?')
    .bind(displayName, category, description, storageKey)
    .run()

  return { ...existing, displayName, category, description }
}

// R2 delete happens first: if the D1 delete then failed, a leftover metadata
// row just points at a missing object (harmless, cleanable) rather than the
// reverse order, where a failed R2 delete after the D1 row is gone would let
// syncMissingFileRecords resurrect the "deleted" file as a new Uncategorized
// record.
export async function deleteFile(db: D1Database, bucket: R2Bucket, storageKey: string): Promise<void> {
  await bucket.delete(storageKey)
  await db.prepare('DELETE FROM files WHERE storage_key = ?').bind(storageKey).run()
}

export { baseName }
