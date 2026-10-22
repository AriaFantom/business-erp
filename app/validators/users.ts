import vine from '@vinejs/vine'

export const updateUserRolesValidator = vine.compile(
  vine.object({
    roleIds: vine.array(vine.number().positive()).distinct().minLength(1).maxLength(20),
  })
)

export const updateUserAccessValidator = vine.compile(vine.object({ active: vine.boolean() }))
