import { NextResponse } from 'next/server'
import { getImage } from '@/lib/storage'

// Deliberately dynamic: cover art is generated continuously by the worker, so a
// miss now may be a hit in a minute. Successful responses are immutable and
// cached hard by the browser and any CDN in front; misses are never cached.
export const dynamic = 'force-dynamic'

/** Serves generated cover art and cached favicons from disk or Netlify Blobs. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params

  if (!/^[a-zA-Z0-9._-]+$/.test(key) || key.includes('..')) {
    return new NextResponse('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  }

  const image = await getImage(key)
  if (!image) {
    return new NextResponse('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  }

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      'content-type': image.contentType,
      'content-length': String(image.data.length),
      'cache-control': 'public, max-age=604800, immutable',
    },
  })
}
