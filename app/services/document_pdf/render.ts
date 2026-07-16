import { randomUUID } from 'node:crypto'
import { renderToBuffer } from '@react-pdf/renderer'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import type * as React from 'react'
import { streamStoredObject, NO_STORE } from '#services/file_streaming'

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
 * Stream a stored PDF straight through the app as an attachment. Access stays
 * gated by the calling controller; a missing key resolves to a 404.
 */
export async function streamPdf(
  key: string,
  response: HttpContext['response'],
  filename: string
): Promise<void> {
  await streamStoredObject({ response }, key, {
    mimeType: 'application/pdf',
    downloadName: filename,
    cacheControl: NO_STORE,
  })
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
