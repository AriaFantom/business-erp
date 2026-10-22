import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import AuditEvent from '#models/audit_event'
import { editUserRoles, manageUserAccess } from '#abilities/main'
import { ensureRolesAssignable } from '#services/dashboard_view_models'
import { getUsersViewModel } from '#services/dashboard_view_models'
import { invalidateTreeCache } from '#services/role_hierarchy'

/**
 * Security guarantees for the User List role-edit surface. All rules below
 * are enforced server-side in `editUserRoles` (visibility/edit gate) and
 * `ensureRolesAssignable` (final write-time guard).
 *
 * Test roles use a `t_` prefix so they don't collide with the persistent
 * seeded roles (owner / admin / member).
 */
test.group('User role-editing security', (group) => {
  group.each.setup(async () => {
    await invalidateTreeCache()
    return testUtils.db().withGlobalTransaction()
  })

  /**
   * Build a baseline ranking: owner, seeded roles, watcher, lead,
   * editor, viewer. Legacy parent links do not grant authority.
   */
  async function seedRoles() {
    // Use firstOrCreate so the test works whether or not the role_seeder
    // ran (and whether or not a previous test's truncate wiped it).
    const ownerRole = await Role.firstOrCreate(
      { name: 'owner' },
      {
        name: 'owner',
        displayName: 'Owner',
        isSystem: true,
        parentRoleId: null,
        rankPosition: 0,
      }
    )

    const currentMaximum = await Role.query().max('rank_position as maxPosition')
    const nextPosition = currentMaximum[0].$extras.maxPosition as number
    const watcher = await Role.create({
      name: 't_watcher',
      displayName: 'Test Watcher',
      isSystem: false,
      parentRoleId: ownerRole.id,
      rankPosition: Number(nextPosition) + 1,
    })
    await watcher.syncPermissions(['users.view'])

    const lead = await Role.create({
      name: 't_lead',
      displayName: 'Test Lead',
      isSystem: false,
      parentRoleId: ownerRole.id,
      rankPosition: Number(nextPosition) + 2,
    })
    await lead.syncPermissions(['users.view', 'users.assignRole'])

    const editor = await Role.create({
      name: 't_editor',
      displayName: 'Test Editor',
      isSystem: false,
      parentRoleId: lead.id,
      rankPosition: Number(nextPosition) + 3,
    })
    const viewer = await Role.create({
      name: 't_viewer',
      displayName: 'Test Viewer',
      isSystem: false,
      parentRoleId: lead.id,
      rankPosition: Number(nextPosition) + 4,
    })

    await invalidateTreeCache()
    return { ownerRole, lead, editor, viewer, watcher }
  }

  async function makeUser(opts: {
    email: string
    isOwner?: boolean
    roleIds?: number[]
  }): Promise<User> {
    const u = await User.create({
      email: opts.email,
      password: 'password123',
      isOwner: opts.isOwner ?? false,
    })
    if (opts.roleIds && opts.roleIds.length > 0) {
      await u.related('roles').attach(opts.roleIds)
    }
    return u
  }

  // ------------------------------------------------------------------
  // editUserRoles ability
  // ------------------------------------------------------------------

  test('owner can edit any non-owner user', async ({ assert }) => {
    const { editor } = await seedRoles()
    const owner = await makeUser({ email: 'owner@x.test', isOwner: true })
    const target = await makeUser({ email: 't@x.test', roleIds: [editor.id] })
    assert.isTrue(await editUserRoles.execute(owner, target))
  })

  test('actor cannot edit themselves (lockout protection)', async ({ assert }) => {
    const { lead } = await seedRoles()
    const me = await makeUser({ email: 'me@x.test', roleIds: [lead.id] })
    assert.isFalse(await editUserRoles.execute(me, me))
  })

  test('owner cannot edit themselves either', async ({ assert }) => {
    await seedRoles()
    const owner = await makeUser({ email: 'o@x.test', isOwner: true })
    assert.isFalse(await editUserRoles.execute(owner, owner))
  })

  test('workspace owner is immutable through this surface', async ({ assert }) => {
    const { lead } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    const ownerTarget = await makeUser({ email: 'o2@x.test', isOwner: true })
    assert.isFalse(await editUserRoles.execute(actor, ownerTarget))
  })

  test('non-owner without users.assignRole cannot edit anyone', async ({ assert }) => {
    const { editor, watcher } = await seedRoles()
    const actor = await makeUser({ email: 'w@x.test', roleIds: [watcher.id] })
    const target = await makeUser({ email: 't@x.test', roleIds: [editor.id] })
    assert.isFalse(await editUserRoles.execute(actor, target))
  })

  test('lead can edit a target below their rank', async ({ assert }) => {
    const { lead, editor } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    const target = await makeUser({ email: 't@x.test', roleIds: [editor.id] })
    assert.isTrue(await editUserRoles.execute(actor, target))
  })

  test('lead cannot edit a target above their rank', async ({ assert }) => {
    const { lead, watcher } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    const sibling = await makeUser({ email: 's@x.test', roleIds: [watcher.id] })
    assert.isFalse(await editUserRoles.execute(actor, sibling))
  })

  test('lead cannot edit a target with no roles (only owner can bootstrap)', async ({ assert }) => {
    const { lead } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    const orphan = await makeUser({ email: 'o@x.test' })
    assert.isFalse(await editUserRoles.execute(actor, orphan))
  })

  test('multiple roles use the highest rank and never hide a higher target role', async ({
    assert,
  }) => {
    const { lead, editor, viewer, watcher } = await seedRoles()
    const actor = await makeUser({ email: 'multi@x.test', roleIds: [lead.id, viewer.id] })
    const lower = await makeUser({ email: 'lower@x.test', roleIds: [editor.id, viewer.id] })
    const higher = await makeUser({ email: 'higher@x.test', roleIds: [editor.id, watcher.id] })
    assert.isTrue(await editUserRoles.execute(actor, lower))
    assert.isFalse(await editUserRoles.execute(actor, higher))
  })

  test('users view model exposes editable rows and excludes Owner from options', async ({
    assert,
  }) => {
    const { editor, ownerRole } = await seedRoles()
    const owner = await makeUser({
      email: 'view-owner@x.test',
      isOwner: true,
      roleIds: [ownerRole.id],
    })
    const target = await makeUser({ email: 'view-target@x.test', roleIds: [editor.id] })
    const view = await getUsersViewModel(owner)
    assert.isTrue(view.users.find((row) => row.id === target.id)?.editable)
    assert.isFalse(view.users.find((row) => row.id === owner.id)?.editable)
    assert.isFalse(view.assignableRoles.some((role) => role.id === ownerRole.id))
  })

  test('role changes persist multiple assignments with an audit record', async ({
    client,
    assert,
  }) => {
    const { ownerRole, editor, viewer } = await seedRoles()
    const owner = await makeUser({
      email: 'audit-owner@x.test',
      isOwner: true,
      roleIds: [ownerRole.id],
    })
    const target = await makeUser({ email: 'audit-target@x.test', roleIds: [editor.id] })
    const response = await client
      .post(`/system/users/${target.id}/roles`)
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ roleIds: [editor.id, viewer.id] })
    response.assertStatus(302)
    const assigned = await target.related('roles').query()
    assert.sameMembers(
      assigned.map((role) => role.id),
      [editor.id, viewer.id]
    )
    const event = await AuditEvent.query()
      .where('action', 'user.roles.update')
      .where('target_id', target.id)
      .first()
    assert.isNotNull(event)
  })

  test('HTTP role update blocks promotion above the manager', async ({ client, assert }) => {
    const { lead, editor, watcher } = await seedRoles()
    const actor = await makeUser({ email: 'limited@x.test', roleIds: [lead.id] })
    const target = await makeUser({ email: 'limited-target@x.test', roleIds: [editor.id] })
    await client
      .post(`/system/users/${target.id}/roles`)
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({ roleIds: [watcher.id] })
    const assigned = await target.related('roles').query()
    assert.deepEqual(
      assigned.map((role) => role.id),
      [editor.id]
    )
  })

  // ------------------------------------------------------------------
  // ensureRolesAssignable — write-time defence in depth
  // ------------------------------------------------------------------

  test('owner can assign assignable roles, but never the workspace-owner role itself', async ({
    assert,
  }) => {
    const { lead, editor, ownerRole } = await seedRoles()
    const owner = await makeUser({ email: 'o@x.test', isOwner: true })

    await ensureRolesAssignable(owner, [lead.id, editor.id])
    await assert.rejects(
      () => ensureRolesAssignable(owner, [ownerRole.id]),
      /owner role cannot be assigned/i
    )
  })

  test('lead can assign roles below their rank', async ({ assert }) => {
    const { lead, editor, viewer } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    await ensureRolesAssignable(actor, [editor.id, viewer.id])
    assert.isTrue(true)
  })

  test('lead cannot assign roles above their rank (privilege escalation guard)', async ({
    assert,
  }) => {
    const { lead, watcher } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    await assert.rejects(() => ensureRolesAssignable(actor, [watcher.id]), /below your own rank/)
  })

  test('ensureRolesAssignable rejects unknown role ids', async ({ assert }) => {
    await seedRoles()
    const owner = await makeUser({ email: 'o@x.test', isOwner: true })
    await assert.rejects(() => ensureRolesAssignable(owner, [999_999]), /do not exist/)
  })

  test('owner revokes and restores a user with audited access changes', async ({
    client,
    assert,
  }) => {
    const { editor } = await seedRoles()
    const owner = await makeUser({ email: 'access-owner@x.test', isOwner: true })
    const target = await makeUser({ email: 'access-target@x.test', roleIds: [editor.id] })

    const revoke = await client
      .post(`/system/users/${target.id}/access`)
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ active: false })
    revoke.assertStatus(302)
    await target.refresh()
    assert.isFalse(target.isActive)
    assert.isNotNull(
      await AuditEvent.query()
        .where('action', 'user.access.revoke')
        .where('target_id', target.id)
        .first()
    )

    const blocked = await client.get('/dashboard').loginAs(target).redirects(0)
    blocked.assertStatus(302)
    assert.include(blocked.header('location'), '/login')

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ email: target.email, password: 'password123' })
    login.assertStatus(302)
    const stillBlocked = await client.get('/dashboard').redirects(0)
    stillBlocked.assertStatus(302)
    assert.include(stillBlocked.header('location'), '/login')

    const restore = await client
      .post(`/system/users/${target.id}/access`)
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ active: true })
    restore.assertStatus(302)
    await target.refresh()
    assert.isTrue(target.isActive)
    assert.isNotNull(
      await AuditEvent.query()
        .where('action', 'user.access.restore')
        .where('target_id', target.id)
        .first()
    )
  })

  test('cannot revoke self, Owner, or a user above the actor rank', async ({ client, assert }) => {
    const { lead, watcher, editor } = await seedRoles()
    const actor = await makeUser({ email: 'access-manager@x.test', roleIds: [lead.id] })
    const senior = await makeUser({ email: 'access-senior@x.test', roleIds: [watcher.id] })
    const junior = await makeUser({ email: 'access-junior@x.test', roleIds: [editor.id] })
    const owner = await makeUser({ email: 'access-owner2@x.test', isOwner: true })
    assert.isFalse(await manageUserAccess.execute(actor, actor))
    assert.isFalse(await manageUserAccess.execute(actor, senior))
    assert.isFalse(await manageUserAccess.execute(actor, owner))
    assert.isFalse(await manageUserAccess.execute(actor, junior))

    const blocked = await client
      .post(`/system/users/${senior.id}/access`)
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({ active: false })
    blocked.assertStatus(302)
    await senior.refresh()
    assert.isTrue(senior.isActive)
  })
})
