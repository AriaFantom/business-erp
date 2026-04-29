import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import { permissions } from '#start/permissions'

export default class extends BaseSeeder {
  async run() {
    const owner = await Role.updateOrCreate(
      { name: 'owner' },
      { name: 'owner', displayName: 'Owner', isSystem: true, description: 'Full access' }
    )
    await owner.syncPermissions(permissions.active()) // every active key

    const admin = await Role.updateOrCreate(
      { name: 'admin' },
      { name: 'admin', displayName: 'Admin', isSystem: true }
    )
    await admin.syncPermissions(permissions.active().filter((k) => !k.startsWith('roles.')))

    const member = await Role.updateOrCreate(
      { name: 'member' },
      { name: 'member', displayName: 'Member', isSystem: true }
    )
    await member.syncPermissions(permissions.active().filter((k) => k.endsWith('.view')))
  }
}
