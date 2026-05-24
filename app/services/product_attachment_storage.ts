import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
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
    .orderBy('created_at', 'desc')
  return rows
}
