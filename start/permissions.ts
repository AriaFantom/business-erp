// start/permissions.ts
import { definePermissions } from '#permissions/define_permissions'

export const permissions = definePermissions({
  users: {
    view: 'View user list',
    invite: 'Send invitations to new users',
    update: 'Edit user details',
    remove: { description: 'Delete users', aliases: ['users.delete'] },
    assignRole: 'Assign roles to users',
  },
  roles: {
    view: 'View roles',
    create: 'Create new roles',
    update: 'Edit existing roles',
    delete: 'Delete roles',
  },
  invitations: {
    view: 'View pending invitations',
    resend: 'Re-send invitation emails',
    revoke: 'Cancel pending invitations',
  },
})

export type AppPermissions = typeof permissions
