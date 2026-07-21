import drive from '@adonisjs/drive/services/main'
import type { Readable } from 'node:stream'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Cache-Control presets. Stored objects are private (auth-gated), so both
 * variants are marked `private`. Content-addressed assets (their URL carries a
 * `?v=<key-basename>` token) can be cached forever; anything sensitive or
 * regenerated on each request must never be stored.
 */
export const IMMUTABLE_PRIVATE = 'private, max-age=31536000, immutable'
export const NO_STORE = 'private, no-store'

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
}

function mimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

/**
 * The opaque cache-busting token for a stored object: the uuid+ext basename.
 * Callers append it as `?v=<token>` so a replaced image gets a fresh URL while
 * an unchanged one stays cacheable.
 */
export function token(key: string): string {
  return key.split('/').pop() ?? key
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n"\\]/g, '_')
}

type StreamOpts = {
  mimeType?: string | null
  downloadName?: string | null
  cacheControl: string
}

/**
 * Stream a stored object straight through the app so access stays gated by the
 * calling controller's authorization. Missing keys resolve to a 404; mid-stream
 * read failures are handled by the response's error callback.
 */
export async function streamStoredObject(
  { response }: Pick<HttpContext, 'response'>,
  key: string,
  opts: StreamOpts
) {
  let stream: Readable
  try {
    stream = await drive.use().getStream(key)
  } catch {
    return response.notFound({ error: 'File not found' })
  }

  response.header('Content-Type', opts.mimeType || mimeFromKey(key))
  response.header('Cache-Control', opts.cacheControl)
  if (opts.downloadName) {
    response.header(
      'Content-Disposition',
      `attachment; filename="${sanitizeFilename(opts.downloadName)}"`
    )
  } else {
    response.header('Content-Disposition', 'inline')
  }

  return response.stream(stream, (error) =>
    error.code === 'ENOENT' ? ['File not found', 404] : ['Could not stream file', 500]
  )
}
