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
        priority: 100,
      }
    )
    await owner.syncPermissions(permissions.active()) // every active key

    const admin = await Role.updateOrCreate(
      { name: 'admin' },
      {
        name: 'admin',
        displayName: 'Admin',
        isSystem: true,
        description: 'Manage users and invitations',
        priority: 50,
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
        priority: 10,
      }
    )
    await member.syncPermissions(permissions.active().filter((k) => k.endsWith('.view')))
  }
}
