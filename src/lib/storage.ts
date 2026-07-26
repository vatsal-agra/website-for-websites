import fs from 'node:fs'
import path from 'node:path'
import { env, paths } from './env'

/**
 * Where generated cover art lives.
 *
 * Locally that is `data/thumbs`. On Netlify there is no persistent disk between
 * invocations, so the same keys are stored in Netlify Blobs instead. Callers
 * never need to know which is in use.
 */

const STORE_NAME = 'portico-covers'

/** Only ever a flat filename — never a path. */
export function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '')
}

export const usingBlobs = env.isNetlify

let blobStore: any | null = null
async function store() {
  if (blobStore) return blobStore
  const { getStore } = await import('@netlify/blobs')
  blobStore = getStore({ name: STORE_NAME, consistency: 'eventual' })
  return blobStore
}

export function localPath(key: string): string {
  return path.join(paths.thumbs, safeKey(key))
}

export async function putImage(key: string, data: Buffer, contentType: string): Promise<void> {
  const safe = safeKey(key)
  if (usingBlobs) {
    const s = await store()
    await s.set(safe, data, { metadata: { contentType } })
    return
  }
  fs.mkdirSync(paths.thumbs, { recursive: true })
  fs.writeFileSync(localPath(safe), data)
}

export async function getImage(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  const safe = safeKey(key)
  const contentType = safe.endsWith('.png')
    ? 'image/png'
    : safe.endsWith('.webp')
      ? 'image/webp'
      : 'application/octet-stream'

  if (usingBlobs) {
    try {
      const s = await store()
      const result = await s.getWithMetadata(safe, { type: 'arrayBuffer' })
      if (!result?.data) return null
      return {
        data: Buffer.from(result.data as ArrayBuffer),
        contentType: (result.metadata?.contentType as string) || contentType,
      }
    } catch {
      return null
    }
  }

  const file = localPath(safe)
  if (!fs.existsSync(file)) return null
  return { data: fs.readFileSync(file), contentType }
}

export async function deleteImage(key: string | null | undefined): Promise<void> {
  if (!key) return
  const safe = safeKey(key)
  if (usingBlobs) {
    try {
      const s = await store()
      await s.delete(safe)
    } catch {
      /* already gone */
    }
    return
  }
  try {
    fs.rmSync(localPath(safe), { force: true })
  } catch {
    /* ignore */
  }
}

export async function imageExists(key: string | null | undefined): Promise<boolean> {
  if (!key) return false
  if (usingBlobs) return (await getImage(key)) !== null
  return fs.existsSync(localPath(key))
}
