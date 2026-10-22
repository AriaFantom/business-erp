import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import User from '#models/user'
import { rankedRoles } from '#services/role_order'
import RoleSeeder from '../../../database/seeders/role_seeder.js'

async function rankedIds() {
  const roles = await rankedRoles()
  return roles.map((role) => role.id)
}

test.group('Ranked roles', (group) => {
  group.each.setup(async () => {
    const rollback = await testUtils.db().withGlobalTransaction()
    await new RoleSeeder(db.connection()).run()
    return rollback
  })

  async function fixture() {
    const existing = await rankedRoles()
    const base = existing.length
    const manager = await Role.create({
      name: 'rank_manager',
      displayName: 'Rank Manager',
      isSystem: false,
      parentRoleId: null,
      rankPosition: base,
    })
    await manager.syncPermissions(['roles.view', 'roles.update', 'users.assignRole'])
    const lowerA = await Role.create({
      name: 'rank_a',
      displayName: 'Rank A',
      isSystem: false,
      parentRoleId: null,
      rankPosition: base + 1,
    })
    const lowerB = await Role.create({
      name: 'rank_b',
      displayName: 'Rank B',
      isSystem: false,
      parentRoleId: null,
      rankPosition: base + 2,
    })
    const owner = await User.create({
      email: 'rank-owner@test.invalid',
      password: 'password123',
      isOwner: true,
    })
    const ownerRole = await Role.findByOrFail('name', 'owner')
    await owner.related('roles').attach([ownerRole.id])
    const actor = await User.create({
      email: 'rank-manager@test.invalid',
      password: 'password123',
      isOwner: false,
    })
    await actor.related('roles').attach([manager.id])
    return { manager, lowerA, lowerB, owner, actor }
  }

  test('owner saves a complete ranking that survives reload', async ({ client, assert }) => {
    const { lowerA, lowerB, owner } = await fixture()
    const originalIds = await rankedIds()
    const orderedIds = [...originalIds]
    const a = orderedIds.indexOf(lowerA.id)
    const b = orderedIds.indexOf(lowerB.id)
    ;[orderedIds[a], orderedIds[b]] = [orderedIds[b], orderedIds[a]]
    const response = await client
      .post('/roles/reorder')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ orderedIds, originalIds })
    response.assertStatus(302)
    assert.deepEqual(await rankedIds(), orderedIds)
  })

  test('manager cannot move their own rank but may reorder lower roles', async ({
    client,
    assert,
  }) => {
    const { manager, lowerA, lowerB, actor } = await fixture()
    const originalIds = await rankedIds()
    const forbiddenIds = [...originalIds]
    const managerIndex = forbiddenIds.indexOf(manager.id)
    ;[forbiddenIds[managerIndex], forbiddenIds[managerIndex + 1]] = [
      forbiddenIds[managerIndex + 1],
      forbiddenIds[managerIndex],
    ]
    await client
      .post('/roles/reorder')
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({ orderedIds: forbiddenIds, originalIds })
    assert.deepEqual(await rankedIds(), originalIds)

    const allowedIds = [...originalIds]
    const a = allowedIds.indexOf(lowerA.id)
    const b = allowedIds.indexOf(lowerB.id)
    ;[allowedIds[a], allowedIds[b]] = [allowedIds[b], allowedIds[a]]
    await client
      .post('/roles/reorder')
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({ orderedIds: allowedIds, originalIds })
    assert.deepEqual(await rankedIds(), allowedIds)
  })

  test('stale ordering is rejected without mutation', async ({ client, assert }) => {
    const { lowerA, lowerB, owner } = await fixture()
    const originalIds = await rankedIds()
    const orderedIds = [...originalIds]
    const a = orderedIds.indexOf(lowerA.id)
    const b = orderedIds.indexOf(lowerB.id)
    ;[orderedIds[a], orderedIds[b]] = [orderedIds[b], orderedIds[a]]
    await client
      .post('/roles/reorder')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ orderedIds, originalIds: [...originalIds].reverse() })
    assert.deepEqual(await rankedIds(), originalIds)
  })

  test('seeder preserves existing custom rank positions', async ({ assert }) => {
    const admin = await Role.findByOrFail('name', 'admin')
    const member = await Role.findByOrFail('name', 'member')
    const adminPosition = admin.rankPosition
    const memberPosition = member.rankPosition
    admin.rankPosition = memberPosition
    member.rankPosition = adminPosition
    await admin.save()
    await member.save()
    await new RoleSeeder(db.connection()).run()
    await admin.refresh()
    await member.refresh()
    assert.equal(admin.rankPosition, memberPosition)
    assert.equal(member.rankPosition, adminPosition)
  })
})
