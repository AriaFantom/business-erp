import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import { editUserRoles } from '#abilities/main'
import { ensureRolesAssignable } from '#services/dashboard_view_models'
import { invalidateTreeCache } from '#services/role_hierarchy'

/**
 * Security guarantees for the User List role-edit surface. All rules below
 * are enforced server-side in `editUserRoles` (visibility/edit gate) and
 * `ensureRolesAssignable` (final write-time guard).
 *
 * Test roles use a `t_` prefix so they don't collide with the persistent
 * seeded tree (owner / admin / member).
 */
test.group('User role-editing security', (group) => {
  group.each.setup(async () => {
    await invalidateTreeCache()
    return testUtils.db().withGlobalTransaction()
  })

  /**
   * Build a baseline test tree under the seeded `owner` role:
   *   owner (seeded)
   *     t_lead   (users.assignRole, users.view)
   *       t_editor
   *       t_viewer
   *     t_watcher (users.view only — sibling of t_lead, no assignRole)
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
      }
    )

    const lead = await Role.create({
      name: 't_lead',
      displayName: 'Test Lead',
      isSystem: false,
      parentRoleId: ownerRole.id,
    })
    await lead.syncPermissions(['users.view', 'users.assignRole'])

    const editor = await Role.create({
      name: 't_editor',
      displayName: 'Test Editor',
      isSystem: false,
      parentRoleId: lead.id,
    })
    const viewer = await Role.create({
      name: 't_viewer',
      displayName: 'Test Viewer',
      isSystem: false,
      parentRoleId: lead.id,
    })

    const watcher = await Role.create({
      name: 't_watcher',
      displayName: 'Test Watcher',
      isSystem: false,
      parentRoleId: ownerRole.id,
    })
    await watcher.syncPermissions(['users.view'])

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

  test('lead can edit a target inside their subtree', async ({ assert }) => {
    const { lead, editor } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    const target = await makeUser({ email: 't@x.test', roleIds: [editor.id] })
    assert.isTrue(await editUserRoles.execute(actor, target))
  })

  test('lead cannot edit a target whose role sits outside their subtree', async ({
    assert,
  }) => {
    const { lead, watcher } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    const sibling = await makeUser({ email: 's@x.test', roleIds: [watcher.id] })
    assert.isFalse(await editUserRoles.execute(actor, sibling))
  })

  test('lead cannot edit a target with no roles (only owner can bootstrap)', async ({
    assert,
  }) => {
    const { lead } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    const orphan = await makeUser({ email: 'o@x.test' })
    assert.isFalse(await editUserRoles.execute(actor, orphan))
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

  test('lead can assign roles inside their subtree', async ({ assert }) => {
    const { lead, editor, viewer } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    await ensureRolesAssignable(actor, [editor.id, viewer.id])
    assert.isTrue(true)
  })

  test('lead cannot assign roles outside their subtree (privilege escalation guard)', async ({
    assert,
  }) => {
    const { lead, watcher } = await seedRoles()
    const actor = await makeUser({ email: 'a@x.test', roleIds: [lead.id] })
    await assert.rejects(
      () => ensureRolesAssignable(actor, [watcher.id]),
      /outside your subtree/
    )
  })

  test('ensureRolesAssignable rejects unknown role ids', async ({ assert }) => {
    await seedRoles()
    const owner = await makeUser({ email: 'o@x.test', isOwner: true })
    await assert.rejects(() => ensureRolesAssignable(owner, [999_999]), /do not exist/)
  })
})
