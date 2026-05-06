import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

type ImageKind = 'product' | 'material' | 'component'

const PREFIX: Record<ImageKind, string> = {
  product: 'catalog/products',
  material: 'catalog/materials',
  component: 'catalog/components',
}

type ImageOwner = { imageKey: string | null; save: () => Promise<unknown> }

export async function storeCatalogImage(
  kind: ImageKind,
  owner: ImageOwner,
  file: MultipartFile
): Promise<void> {
  const previousKey = owner.imageKey
  const newKey = `${PREFIX[kind]}/${randomUUID()}.${file.extname}`

  await file.moveToDisk(newKey)

  owner.imageKey = newKey
  await owner.save()

  if (previousKey && previousKey !== newKey) {
    try {
      await drive.use().delete(previousKey)
    } catch (err) {
      logger.warn(
        { err, key: previousKey },
        'catalog_image_storage: failed to delete previous image'
      )
    }
  }
}

export async function removeCatalogImage(owner: ImageOwner): Promise<void> {
  const key = owner.imageKey
  if (!key) return

  try {
    await drive.use().delete(key)
  } catch (err) {
    logger.warn({ err, key }, 'catalog_image_storage: failed to delete image from disk')
  }

  owner.imageKey = null
  await owner.save()
}

export async function signCatalogImageUrl(key: string | null): Promise<string | null> {
  if (!key) return null
  try {
    return await drive.use().getSignedUrl(key, { expiresIn: '1 hour' })
  } catch (err) {
    logger.warn({ err, key }, 'catalog_image_storage: failed to sign image url')
    return null
  }
}
