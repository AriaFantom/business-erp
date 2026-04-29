// start/permissions.ts
import { definePermissions } from '#permissions/define_permissions'

export const permissions = definePermissions({
  users: { view: true, invite: true, update: true, remove: { aliases: ['users.delete'] } },
  roles: { view: true, manage: 'Create, edit, delete roles' },
})

export type AppPermissions = typeof permissions
