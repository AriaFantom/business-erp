import vine from '@vinejs/vine'

/**
 * Used when the invitee submits the accept-invitation form.
 * Email is optional here because for a "regular" invitation the
 * server already has it from the invitation row and we ignore
 * whatever the client sends. For "setup" invitations the user
 * must provide an email.
 */
export const acceptInvitationValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail().optional(),
    password: vine.string().minLength(8).maxLength(128).confirmed(),
    firstName: vine.string().trim().minLength(1).maxLength(80),
    lastName: vine.string().trim().minLength(1).maxLength(80),
  })
)

/**
 * Used by the owner/admin when creating an invitation for someone else.
 */
export const createInvitationValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    roleId: vine.number().positive(),
  })
)
