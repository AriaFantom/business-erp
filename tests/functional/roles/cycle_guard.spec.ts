import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Role from '#models/role'
import { getTree, invalidateTreeCache } from '#services/role_hierarchy'

test.group('Role cycle guard + cache invalidation', (group) => {
  group.each.setup(async () => {
    await invalidateTreeCache()
  })

  group.each.teardown(() => testUtils.db().truncate())

  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creating a fresh role under an existing parent succeeds', async ({ assert }) => {
    const root = await Role.create({
      name: 'root_a',
      displayName: 'Root A',
      isSystem: false,
      parentRoleId: null,
    })
    const child = await Role.create({
      name: 'child_a',
      displayName: 'Child A',
      isSystem: false,
      parentRoleId: root.id,
    })
    assert.equal(child.parentRoleId, root.id)
  })

  test('saving a role with parentRoleId === id throws', async ({ assert }) => {
    const r = await Role.create({
      name: 'self_parent',
      displayName: 'Self',
      isSystem: false,
      parentRoleId: null,
    })
    r.parentRoleId = r.id
    await assert.rejects(() => r.save(), /own parent|Cycle/)
  })

  test('reparenting a role under one of its descendants throws', async ({ assert }) => {
    const a = await Role.create({
      name: 'a_node',
      displayName: 'A',
      isSystem: false,
      parentRoleId: null,
    })
    const b = await Role.create({
      name: 'b_node',
      displayName: 'B',
      isSystem: false,
      parentRoleId: a.id,
    })
    a.parentRoleId = b.id
    await assert.rejects(() => a.save(), /Cycle/)
  })

  test('afterSave invalidates the cached tree', async ({ assert }) => {
    const r = await Role.create({
      name: 'cache_test',
      displayName: 'Cache Test',
      isSystem: false,
      parentRoleId: null,
    })
    const tree = await getTree()
    assert.isTrue(tree.has(r.id))
  })

  test('afterDelete invalidates the cached tree', async ({ assert }) => {
    const r = await Role.create({
      name: 'cache_delete',
      displayName: 'Cache Delete',
      isSystem: false,
      parentRoleId: null,
    })
    await getTree() // populate cache with r present
    await r.delete()
    const tree = await getTree()
    assert.isFalse(tree.has(r.id))
  })
})
