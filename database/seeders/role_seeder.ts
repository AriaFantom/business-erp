import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import { permissions } from '#start/permissions'
import { lockRoleOrder, rankedRoles } from '#services/role_order'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

async function saveSystemRole(
  trx: TransactionClientContract,
  values: Pick<Role, 'name' | 'displayName' | 'description' | 'parentRoleId' | 'permissions'>
): Promise<Role> {
  const existing = await Role.query({ client: trx }).where('name', values.name).first()
  const role = existing ?? new Role()
  const ordered = existing ? [] : await rankedRoles(trx)
  role.useTransaction(trx)
  role.merge({
    ...values,
    isSystem: true,
    rankPosition: existing
      ? existing.rankPosition
      : values.name === 'owner'
        ? 0
        : ordered.length
          ? Math.max(...ordered.map((item) => item.rankPosition)) + 1
          : 0,
  })
  await role.save()
  return role
}

export default class extends BaseSeeder {
  async run() {
    await db.transaction(async (trx) => {
      await lockRoleOrder(trx)
      const ownerExists = await Role.query({ client: trx }).where('name', 'owner').first()
      if (!ownerExists) {
        // A newly restored Owner must be inserted ahead of any surviving roles.
        await trx.from('roles').increment('rank_position', 1)
      }
      const owner = await saveSystemRole(trx, {
        name: 'owner',
        displayName: 'Owner',
        description: 'Full access',
        parentRoleId: null,
        permissions: permissions.active(),
      })

      const admin = await saveSystemRole(trx, {
        name: 'admin',
        displayName: 'Admin',
        description: 'Manage users and invitations',
        parentRoleId: owner.id,
        permissions: permissions.active().filter((key) => !key.startsWith('roles.')),
      })

      await saveSystemRole(trx, {
        name: 'member',
        displayName: 'Member',
        description: 'Read-only access',
        parentRoleId: admin.id,
        permissions: permissions
          .active()
          .filter((key) => key.endsWith('.view') && !key.startsWith('settings.')),
      })
    })
  }
}
