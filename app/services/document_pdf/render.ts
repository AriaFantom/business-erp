import { randomUUID } from 'node:crypto'
import { renderToBuffer } from '@react-pdf/renderer'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import type * as React from 'react'

type DocKind = 'invoice' | 'quotation'

const PREFIX: Record<DocKind, string> = {
  invoice: 'documents/invoices',
  quotation: 'documents/quotations',
}

type StoredDoc = {
  id: number
  pdfKey: string | null
  save(): Promise<unknown>
}

/**
 * Lazily render and persist a PDF for a document. Returns the storage key.
 * Subsequent calls for the same doc reuse the stored key until invalidated.
 */
export async function ensurePdf(
  kind: DocKind,
  doc: StoredDoc,
  buildElement: () => React.ReactElement
): Promise<string> {
  if (doc.pdfKey) return doc.pdfKey
  const buffer = await renderToBuffer(buildElement() as never)
  const key = `${PREFIX[kind]}/${doc.id}-${randomUUID()}.pdf`
  await drive.use().put(key, buffer, {
    contentType: 'application/pdf',
  } as never)
  doc.pdfKey = key
  await doc.save()
  return key
}

/**
 * Stream a stored PDF to the client via a signed URL redirect (S3/MinIO
 * serves directly). Falls back to streaming the buffer if signing fails.
 */
export async function streamPdf(
  key: string,
  response: HttpContext['response'],
  filename: string
): Promise<void> {
  try {
    const url = await drive.use().getSignedUrl(key, {
      expiresIn: '5 minutes',
      contentDisposition: `attachment; filename="${filename}"`,
    } as never)
    response.redirect(url)
    return
  } catch (err) {
    logger.warn({ err, key }, 'document_pdf: signed URL failed, streaming buffer')
    const buffer = await drive.use().getBytes(key)
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    response.type('application/pdf')
    response.send(Buffer.from(buffer))
  }
}

/**
 * Drop a doc's cached PDF so the next download regenerates with the latest
 * source data. Idempotent — safe to call when there is no cached PDF.
 */
export async function invalidatePdf(doc: StoredDoc): Promise<void> {
  if (!doc.pdfKey) return
  try {
    await drive.use().delete(doc.pdfKey)
  } catch (err) {
    logger.warn({ err, key: doc.pdfKey }, 'document_pdf: failed to delete previous PDF from disk')
  }
  doc.pdfKey = null
  await doc.save()
}
