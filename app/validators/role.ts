import vine from '@vinejs/vine'

const slugRule = vine
  .string()
  .trim()
  .minLength(2)
  .maxLength(48)
  .regex(/^[a-z][a-z0-9_-]*$/)

export const createRoleValidator = vine.compile(
  vine.object({
    name: slugRule,
    displayName: vine.string().trim().minLength(1).maxLength(80),
    description: vine.string().trim().maxLength(280).optional(),
    priority: vine.number().min(0).max(99),
    permissions: vine.array(vine.string().trim()).optional(),
  })
)
