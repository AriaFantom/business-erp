import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import ProductAttachment from '#models/product_attachment'
import type Product from '#models/product'

export async function storeProductFile(
  product: Product,
  file: MultipartFile,
  uploadedByUserId: number | null
): Promise<ProductAttachment> {
  const ext = file.extname || 'bin'
  const key = `catalog/products/${product.id}/files/${randomUUID()}.${ext}`
  await file.moveToDisk(key)

  const attachment = await ProductAttachment.create({
    productId: product.id,
    fileKey: key,
    originalName: file.clientName,
    sizeBytes: file.size,
    mimeType: file.headers['content-type'] || null,
    uploadedByUserId,
  })
  return attachment
}

export async function removeProductFile(attachment: ProductAttachment): Promise<void> {
  try {
    await drive.use().delete(attachment.fileKey)
  } catch (err) {
    logger.warn(
      { err, key: attachment.fileKey },
      'product_attachment_storage: failed to delete file from disk'
    )
  }
  await attachment.delete()
}

export async function signProductFileUrl(
  attachment: Pick<ProductAttachment, 'fileKey' | 'originalName'>
): Promise<string | null> {
  try {
    return await drive.use().getSignedUrl(attachment.fileKey, {
      expiresIn: '5 minutes',
      contentDisposition: `attachment; filename="${attachment.originalName}"`,
    })
  } catch (err) {
    logger.warn(
      { err, key: attachment.fileKey },
      'product_attachment_storage: failed to sign file url'
    )
    return null
  }
}

export async function listProductAttachments(productId: number) {
  const rows = await ProductAttachment.query()
    .where('product_id', productId)
    .where('kind', 'file')
    .orderBy('created_at', 'desc')
  return rows
}

const IMAGE_PREFIX = 'catalog/products/gallery'

export async function storeProductImage(
  product: { id: number },
  file: MultipartFile,
  userId: number | null
): Promise<ProductAttachment> {
  const ext = file.extname ?? 'bin'
  const fileKey = `${IMAGE_PREFIX}/${product.id}/${randomUUID()}.${ext}`
  await file.moveToDisk(fileKey)

  const maxSort = await db
    .from('product_attachments')
    .where('product_id', product.id)
    .where('kind', 'image')
    .max({ m: 'sort_order' })
    .first()
  const nextSort = Number(maxSort?.m ?? 0) + 1

  const mime =
    file.type && file.subtype ? `${file.type}/${file.subtype}` : (file.type ?? null)

  return ProductAttachment.create({
    productId: product.id,
    fileKey,
    originalName: file.clientName,
    sizeBytes: file.size,
    mimeType: mime,
    uploadedByUserId: userId,
    kind: 'image',
    sortOrder: nextSort,
  })
}

export async function listProductImages(productId: number) {
  return db
    .from('product_attachments')
    .where('product_id', productId)
    .where('kind', 'image')
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .select('id', 'original_name', 'sort_order', 'file_key', 'created_at')
}

export async function reorderProductImages(
  productId: number,
  ordering: Array<{ id: number; sortOrder: number }>
) {
  const ids = ordering.map((o) => o.id)
  const owned = await db
    .from('product_attachments')
    .where('product_id', productId)
    .where('kind', 'image')
    .whereIn('id', ids)
    .select('id')
  if (owned.length !== ids.length) {
    throw new Error('One or more attachments do not belong to this product')
  }
  await db.transaction(async (trx) => {
    for (const o of ordering) {
      await trx
        .from('product_attachments')
        .where('id', o.id)
        .update({ sort_order: o.sortOrder })
    }
  })
}
