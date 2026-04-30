import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import { permissions } from '#start/permissions'

export default class extends BaseSeeder {
  async run() {
    const owner = await Role.updateOrCreate(
      { name: 'owner' },
      {
        name: 'owner',
        displayName: 'Owner',
        isSystem: true,
        description: 'Full access',
        parentRoleId: null,
      }
    )
    await owner.syncPermissions(permissions.active())

    const admin = await Role.updateOrCreate(
      { name: 'admin' },
      {
        name: 'admin',
        displayName: 'Admin',
        isSystem: true,
        description: 'Manage users and invitations',
        parentRoleId: owner.id,
      }
    )
    await admin.syncPermissions(permissions.active().filter((k) => !k.startsWith('roles.')))

    const member = await Role.updateOrCreate(
      { name: 'member' },
      {
        name: 'member',
        displayName: 'Member',
        isSystem: true,
        description: 'Read-only access',
        parentRoleId: admin.id,
      }
    )
    await member.syncPermissions(permissions.active().filter((k) => k.endsWith('.view')))
  }
}
