import { test } from '@japa/runner'
import {
  buildTree,
  getDescendants,
  getAncestors,
  cycleCheck,
  type RoleRow,
} from '#services/role_hierarchy'

// Fixture: owner -> admin -> member, owner -> guest (sibling of admin)
const ROWS: RoleRow[] = [
  { id: 1, parent_role_id: null, name: 'owner' },
  { id: 2, parent_role_id: 1, name: 'admin' },
  { id: 3, parent_role_id: 2, name: 'member' },
  { id: 4, parent_role_id: 1, name: 'guest' },
]

test.group('role_hierarchy: buildTree', () => {
  test('returns a node per row with parent and children populated', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.equal(tree.size, 4)
    assert.deepEqual(tree.get(1)!.children.sort(), [2, 4])
    assert.deepEqual(tree.get(2)!.children, [3])
    assert.deepEqual(tree.get(3)!.children, [])
    assert.equal(tree.get(3)!.parentRoleId, 2)
    assert.equal(tree.get(1)!.parentRoleId, null)
  })

  test('treats orphans (parent_role_id pointing to a missing id) as roots', ({ assert }) => {
    const tree = buildTree([{ id: 10, parent_role_id: 999, name: 'orphan' }])
    assert.equal(tree.size, 1)
    assert.deepEqual(tree.get(10)!.children, [])
  })
})

test.group('role_hierarchy: getDescendants', () => {
  test('returns strict descendants (excludes self)', ({ assert }) => {
    const tree = buildTree(ROWS)
    const desc = new Set(getDescendants(2, tree))
    assert.deepEqual([...desc].sort(), [3])
  })

  test('returns the whole subtree from the root', ({ assert }) => {
    const tree = buildTree(ROWS)
    const desc = new Set(getDescendants(1, tree))
    assert.deepEqual([...desc].sort(), [2, 3, 4])
  })

  test('returns empty for a leaf', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.deepEqual(getDescendants(3, tree), [])
  })

  test('returns empty for an unknown id', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.deepEqual(getDescendants(999, tree), [])
  })

  test('does not infinite-loop when children references a missing id', ({ assert }) => {
    const tree = buildTree(ROWS)
    tree.get(2)!.children.push(12345)
    assert.deepEqual(getDescendants(2, tree).sort(), [3])
  })
})

test.group('role_hierarchy: getAncestors', () => {
  test('walks up to the root, excluding self', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.deepEqual(getAncestors(3, tree), [2, 1])
  })

  test('returns empty for a root', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.deepEqual(getAncestors(1, tree), [])
  })

  test('returns empty for an unknown id', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.deepEqual(getAncestors(999, tree), [])
  })
})

test.group('role_hierarchy: cycleCheck', () => {
  test('null parent never cycles', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.isFalse(cycleCheck(2, null, tree))
  })

  test('self-parent is a cycle', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.isTrue(cycleCheck(2, 2, tree))
  })

  test('parent inside own subtree is a cycle', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.isTrue(cycleCheck(2, 3, tree))
  })

  test('sibling parent is fine', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.isFalse(cycleCheck(2, 4, tree))
  })

  test('parent above is fine', ({ assert }) => {
    const tree = buildTree(ROWS)
    assert.isFalse(cycleCheck(3, 1, tree))
  })
})
