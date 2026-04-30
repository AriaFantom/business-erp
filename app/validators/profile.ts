import vine from '@vinejs/vine'

/**
 * Profile data update — first/last name only.
 * Avatar uploads have their own validator/route.
 */
export const updateProfileValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().maxLength(80).nullable(),
    lastName: vine.string().trim().maxLength(80).nullable(),
  })
)

/**
 * Avatar upload — single image file, capped at 2 MB.
 * VineJS validates extension and size; controller writes to Drive.
 */
export const updateAvatarValidator = vine.compile(
  vine.object({
    avatar: vine.file({
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    }),
  })
)
