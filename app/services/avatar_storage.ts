import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type User from '#models/user'

const AVATAR_PREFIX = 'avatars'

/**
 * Move an uploaded image into permanent storage, point the user at it,
 * and best-effort delete the previous avatar (if any).
 *
 * The new key is persisted before the old one is deleted; a delete
 * failure is logged but does not fail the upload, because the
 * user-visible state (the new avatar) is already correct.
 */
export async function storeAvatar(user: User, file: MultipartFile): Promise<void> {
  const previousKey = user.avatarKey
  const newKey = `${AVATAR_PREFIX}/${randomUUID()}.${file.extname}`

  await file.moveToDisk(newKey)

  user.avatarKey = newKey
  await user.save()

  if (previousKey && previousKey !== newKey) {
    try {
      await drive.use().delete(previousKey)
    } catch (err) {
      logger.warn({ err, key: previousKey }, 'avatar_storage: failed to delete previous avatar')
    }
  }
}

/**
 * Remove the user's avatar (storage + DB column).
 * Idempotent: calling it on a user with no avatar is a no-op.
 */
export async function removeAvatar(user: User): Promise<void> {
  const key = user.avatarKey
  if (!key) return

  try {
    await drive.use().delete(key)
  } catch (err) {
    logger.warn({ err, key }, 'avatar_storage: failed to delete avatar from disk')
  }

  user.avatarKey = null
  await user.save()
}
