export type FileEntry = {
  key: string
}

export class InvalidFileNameError extends Error {}
export class FileExistsError extends Error {}
export class FileNotFoundError extends Error {}

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

export async function listFiles(bucket: R2Bucket): Promise<FileEntry[]> {
  const objects = await listAllObjects(bucket)
  return objects.filter((f) => !f.key.endsWith('/')).map((f) => ({ key: f.key }))
}

export async function searchFiles(bucket: R2Bucket, query: string): Promise<FileEntry[]> {
  const files = await listFiles(bucket)
  const q = query.trim().toLowerCase()
  if (!q) return files
  return files.filter((f) => f.key.toLowerCase().includes(q))
}

export async function getFile(bucket: R2Bucket, key: string) {
  return bucket.get(key)
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new InvalidFileNameError('Nama file tidak boleh kosong')
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new InvalidFileNameError('Nama file tidak boleh mengandung "/", "\\", atau ".."')
  }
  if (trimmed.length > 255) throw new InvalidFileNameError('Nama file terlalu panjang')
  return trimmed
}

export async function uploadFile(bucket: R2Bucket, file: File) {
  const cleanName = sanitizeFileName(file.name)

  const existing = await bucket.head(cleanName)
  if (existing) throw new FileExistsError(`File "${cleanName}" sudah ada`)

  await bucket.put(cleanName, await file.arrayBuffer())
}

export async function deleteFile(bucket: R2Bucket, key: string) {
  await bucket.delete(key)
}

function baseName(key: string): string {
  return key.slice(key.lastIndexOf('/') + 1)
}

function dirName(key: string): string {
  const i = key.lastIndexOf('/')
  return i === -1 ? '' : key.slice(0, i + 1)
}

export async function renameFile(bucket: R2Bucket, key: string, newName: string): Promise<FileEntry> {
  const cleanName = sanitizeFileName(newName)
  const newKey = dirName(key) + cleanName
  if (newKey === key) return { key }

  const existing = await bucket.head(newKey)
  if (existing) throw new FileExistsError(`File "${cleanName}" sudah ada`)

  const object = await bucket.get(key)
  if (!object) throw new FileNotFoundError('File tidak ditemukan')

  await bucket.put(newKey, await object.arrayBuffer(), { httpMetadata: object.httpMetadata })
  await bucket.delete(key)

  return { key: newKey }
}

export { baseName }
