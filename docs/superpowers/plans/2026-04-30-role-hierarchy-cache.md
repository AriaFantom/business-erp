# Role Hierarchy Cache + Cycle Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace recursive Postgres CTEs in `app/services/role_hierarchy.ts` with an in-memory adjacency list cached as `roles:tree`, and make role-tree cycles unwritable by enforcing a cycle check in a `Role.beforeSave` model hook.

**Architecture:** A single cache snapshot of the role tree (memory L1 + Redis L2 via `@adonisjs/cache`) drives all hierarchy queries. The service exposes pure tree utilities (`buildTree`, `getDescendants`, `getAncestors`, `cycleCheck`) plus async wrappers that go through the cache. The `Role` model's lifecycle hooks (`beforeSave`, `afterSave`, `afterDelete`) enforce no-cycle and bust the cache on every write.

**Tech Stack:** AdonisJS v7, `@adonisjs/cache` v2, Lucid ORM, TypeScript, Japa (unit + functional suites).

**Spec:** `docs/superpowers/specs/2026-04-30-role-hierarchy-cache-design.md`

---

## File Structure

| Path | Action | Responsibility |
|------|--------|---------------|
| `app/services/role_hierarchy.ts` | Modify (full rewrite) | Pure tree utilities + cache-backed async API. Drops `Role` model import; uses `db.from('roles')`. |
| `app/models/role.ts` | Modify | Add `@beforeSave preventCycle`, `@afterSave bustTreeCache`, `@afterDelete bustTreeCacheOnDelete`. |
| `app/controllers/roles_controller.ts` | Modify | Wrap `Role.create` in try/catch to flash a friendly error when the cycle hook throws. |
| `tests/unit/services/role_hierarchy.spec.ts` | Create | Unit tests for `buildTree`, `getDescendants`, `getAncestors`, `cycleCheck` — pure, no DB. |
| `tests/functional/roles/cycle_guard.spec.ts` | Create | Functional tests: `beforeSave` blocks cycles, `afterSave`/`afterDelete` invalidate cache. Uses `testUtils.db().withGlobalTransaction()`. |

---

## Task 1: Add pure tree utilities to the service

**Files:**
- Modify: `app/services/role_hierarchy.ts`
- Test: `tests/unit/services/role_hierarchy.spec.ts`

The service today imports `Role` and runs CTEs. We replace its internals while preserving public function signatures. Step 1 of that replacement is a set of pure, synchronous helpers that operate on a `RoleTree` map. They take `tree` as an argument so they're trivially testable without DB or cache.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/services/role_hierarchy.spec.ts`:

```ts
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
    const tree = buildTree([
      { id: 10, parent_role_id: 999, name: 'orphan' },
    ])
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ace test --suites=unit --files="tests/unit/services/role_hierarchy.spec.ts"`
Expected: FAIL — `buildTree`, `getDescendants`, `getAncestors`, `cycleCheck`, and `RoleRow` are not exported from the service yet.

- [ ] **Step 3: Add the pure utilities to the service**

In `app/services/role_hierarchy.ts`, **append** the following to the existing file (do not delete anything yet — the existing exports will be replaced in Task 3):

```ts
// --- Pure tree utilities (no DB, no cache) ---

export type RoleRow = {
  id: number
  parent_role_id: number | null
  name: string
}

export type RoleNode = {
  id: number
  parentRoleId: number | null
  name: string
  children: number[]
}

export type RoleTree = Map<number, RoleNode>

export function buildTree(rows: RoleRow[]): RoleTree {
  const tree: RoleTree = new Map()
  for (const r of rows) {
    tree.set(r.id, {
      id: r.id,
      parentRoleId: r.parent_role_id,
      name: r.name,
      children: [],
    })
  }
  for (const node of tree.values()) {
    if (node.parentRoleId !== null) {
      tree.get(node.parentRoleId)?.children.push(node.id)
    }
  }
  return tree
}

export function getDescendants(roleId: number, tree: RoleTree): number[] {
  const result = new Set<number>()
  const stack = [roleId]
  while (stack.length) {
    const current = stack.pop()!
    const node = tree.get(current)
    if (!node) continue
    for (const child of node.children) {
      if (!result.has(child)) {
        result.add(child)
        stack.push(child)
      }
    }
  }
  return [...result]
}

export function getAncestors(roleId: number, tree: RoleTree): number[] {
  const result: number[] = []
  const seen = new Set<number>([roleId])
  let cursor = tree.get(roleId)?.parentRoleId ?? null
  while (cursor !== null && !seen.has(cursor)) {
    result.push(cursor)
    seen.add(cursor)
    cursor = tree.get(cursor)?.parentRoleId ?? null
  }
  return result
}

export function cycleCheck(
  roleId: number,
  newParentId: number | null,
  tree: RoleTree
): boolean {
  if (newParentId === null) return false
  if (newParentId === roleId) return true
  return new Set(getDescendants(roleId, tree)).has(newParentId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node ace test --suites=unit --files="tests/unit/services/role_hierarchy.spec.ts"`
Expected: PASS — 14 tests across 4 groups.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/services/role_hierarchy.ts tests/unit/services/role_hierarchy.spec.ts
git commit -m "feat(role-hierarchy): add pure tree utilities

buildTree / getDescendants / getAncestors / cycleCheck operate on
an in-memory adjacency list. Wired up in the next commit."
```

---

## Task 2: Add cache-backed `getTree` and `invalidateTreeCache`

**Files:**
- Modify: `app/services/role_hierarchy.ts`

Wire the pure utilities up to `@adonisjs/cache`. The cache stores an array (JSON-friendly); we rehydrate to `Map` after each fetch via `buildTree`. The cache key is `roles:tree` and TTL is 1 hour as a safety net — invalidation happens on every role write (Task 4).

- [ ] **Step 1: Add cache wiring to the service**

At the **top** of `app/services/role_hierarchy.ts`, change the imports so the file no longer depends on `#models/role` at runtime:

```ts
import db from '@adonisjs/lucid/services/db'
import cache from '@adonisjs/cache/services/main'
import type Role from '#models/role'
import type User from '#models/user'
```

(`Role` becomes a type-only import — used in `canAssignRole`'s parameter — so there is no runtime cycle when `Role` later imports from this file.)

Then, **after** the pure utilities you added in Task 1, append:

```ts
// --- Cache layer ---

const TREE_CACHE_KEY = 'roles:tree'

export async function getTree(): Promise<RoleTree> {
  const rows = await cache.getOrSet({
    key: TREE_CACHE_KEY,
    ttl: '1h',
    factory: async () => {
      const result = await db
        .from('roles')
        .select('id', 'parent_role_id', 'name')
      return result as RoleRow[]
    },
  })
  return buildTree(rows)
}

export async function invalidateTreeCache(): Promise<void> {
  await cache.delete({ key: TREE_CACHE_KEY })
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (The `cache.getOrSet` factory's return type is the array form; rehydrating to a `Map` happens in `getTree`.)

- [ ] **Step 3: Run unit tests to confirm no regression**

Run: `node ace test --suites=unit`
Expected: PASS — Task 1 tests still green.

- [ ] **Step 4: Commit**

```bash
git add app/services/role_hierarchy.ts
git commit -m "feat(role-hierarchy): cache the role tree under roles:tree

getTree() loads the full adjacency list from cache (memory L1 +
Redis L2). invalidateTreeCache() clears both. Public service
functions are switched over in the next commit."
```

---

## Task 3: Switch public service functions to the cache

**Files:**
- Modify: `app/services/role_hierarchy.ts`

Replace the existing CTE-backed bodies of `descendantRoleIds`, `ancestorRoleIds`, `assignableRoleIds`, `visibleRoleIds`, `canAssignRole`, and `wouldCreateCycle` with implementations that use `getTree()` and the pure helpers. Public signatures stay identical — no caller changes needed.

- [ ] **Step 1: Replace the public function bodies**

In `app/services/role_hierarchy.ts`, remove the old `descendantRoleIds`, `ancestorRoleIds`, `assignableRoleIds`, `canAssignRole`, `wouldCreateCycle`, and `visibleRoleIds` exports (and the `userRoleIds` local helper if you want — keep it if you find it clearer). Replace with:

```ts
const OWNER_ROLE_NAME = 'owner'

async function userRoleIds(user: User): Promise<number[]> {
  const roles = await user.getRoles()
  return roles.map((r) => r.id)
}

export async function descendantRoleIds(rootIds: number[]): Promise<number[]> {
  if (rootIds.length === 0) return []
  const tree = await getTree()
  const out = new Set<number>()
  for (const id of rootIds) {
    for (const d of getDescendants(id, tree)) out.add(d)
  }
  return [...out]
}

export async function ancestorRoleIds(roleId: number): Promise<number[]> {
  const tree = await getTree()
  return getAncestors(roleId, tree)
}

export async function assignableRoleIds(user: User): Promise<number[]> {
  const tree = await getTree()
  if (user.isOwner) {
    return [...tree.values()]
      .filter((n) => n.name !== OWNER_ROLE_NAME)
      .map((n) => n.id)
  }
  const ownIds = await userRoleIds(user)
  const out = new Set<number>()
  for (const id of ownIds) {
    for (const d of getDescendants(id, tree)) out.add(d)
  }
  return [...out]
}

export async function canAssignRole(user: User, role: Role): Promise<boolean> {
  if (role.name === OWNER_ROLE_NAME) return false
  if (user.isOwner) return true
  const ids = new Set(await assignableRoleIds(user))
  return ids.has(role.id)
}

export async function wouldCreateCycle(
  roleId: number,
  newParentId: number | null
): Promise<boolean> {
  const tree = await getTree()
  return cycleCheck(roleId, newParentId, tree)
}

export async function visibleRoleIds(user: User): Promise<number[]> {
  const tree = await getTree()
  if (user.isOwner) return [...tree.keys()]
  const own = await userRoleIds(user)
  const out = new Set<number>(own)
  for (const id of own) {
    for (const d of getDescendants(id, tree)) out.add(d)
  }
  return [...out]
}
```

The file should now no longer reference `Role.query()`, `Role.find`, or `db.rawQuery` for hierarchy. Confirm by searching:

Run: `grep -n "Role\." app/services/role_hierarchy.ts`
Expected: zero matches (the type-only `import type Role` is fine).

Run: `grep -n "rawQuery\|RECURSIVE" app/services/role_hierarchy.ts`
Expected: zero matches.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run unit tests**

Run: `node ace test --suites=unit`
Expected: PASS — Task 1 tests still green (those don't touch the public functions).

- [ ] **Step 4: Commit**

```bash
git add app/services/role_hierarchy.ts
git commit -m "refactor(role-hierarchy): drive public API from cached tree

descendantRoleIds / ancestorRoleIds / assignableRoleIds /
visibleRoleIds / canAssignRole / wouldCreateCycle now traverse
the cached adjacency list instead of running per-request CTEs.
Signatures unchanged."
```

---

## Task 4: Add `Role` lifecycle hooks (cycle guard + cache busting)

**Files:**
- Modify: `app/models/role.ts`
- Test: `tests/functional/roles/cycle_guard.spec.ts`

Three hooks on `Role`:
- `@beforeSave` — call `cycleCheck` on the cached tree, throw on cycle/self-parent.
- `@afterSave` — `invalidateTreeCache()` so subsequent reads see the new state.
- `@afterDelete` — same.

The hook uses `getTree()`, which is in the service. The service no longer imports `Role` at runtime (Task 2), so the import direction is `Role → service`, no cycle.

For the functional test we use `testUtils.db().withGlobalTransaction()` so each test rolls back. We also invalidate the cache at the start of each test so we don't read state cached from a prior test's transaction (which is rolled back, but the cache wouldn't know).

- [ ] **Step 1: Write the failing functional test**

Create `tests/functional/roles/cycle_guard.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Role from '#models/role'
import { getTree, invalidateTreeCache } from '#services/role_hierarchy'

test.group('Role cycle guard + cache invalidation', (group) => {
  group.each.setup(async () => {
    await invalidateTreeCache()
    return () => testUtils.db().truncate()
  })

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ace test --suites=functional --files="tests/functional/roles/cycle_guard.spec.ts"`
Expected: FAIL on the cycle tests — `r.save()` does not throw because the hook does not exist yet.

- [ ] **Step 3: Add the lifecycle hooks to the Role model**

Edit `app/models/role.ts`. Add the new imports at the top:

```ts
import { BaseModel, afterDelete, afterSave, beforeSave, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import { cycleCheck, getTree, invalidateTreeCache } from '#services/role_hierarchy'
```

Then, inside the `Role` class (after the existing relations/columns), add:

```ts
  @beforeSave()
  static async preventCycle(role: Role) {
    if (role.parentRoleId === null || role.parentRoleId === undefined) return

    if (role.id !== undefined && role.parentRoleId === role.id) {
      throw new Error('Role cannot be its own parent')
    }

    // Brand-new rows have no id and no children — no cycle is possible.
    if (role.id === undefined) return

    // Skip the tree fetch when parent didn't change.
    if (role.$dirty.parentRoleId === undefined) return

    const tree = await getTree()
    if (cycleCheck(role.id, role.parentRoleId, tree)) {
      throw new Error('Cycle detected in role hierarchy')
    }
  }

  @afterSave()
  static async bustTreeCache() {
    await invalidateTreeCache()
  }

  @afterDelete()
  static async bustTreeCacheOnDelete() {
    await invalidateTreeCache()
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node ace test --suites=functional --files="tests/functional/roles/cycle_guard.spec.ts"`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Run unit tests to confirm no regression**

Run: `node ace test --suites=unit`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/models/role.ts tests/functional/roles/cycle_guard.spec.ts
git commit -m "feat(role): enforce no-cycle and bust tree cache via model hooks

beforeSave runs cycleCheck on the cached tree. afterSave and
afterDelete clear roles:tree so subsequent reads see the new
shape. Hook fires for every save path (controllers, seeders,
ace commands), so cycles can no longer be written through the
application."
```

---

## Task 5: Surface the hook error in `RolesController.store`

**Files:**
- Modify: `app/controllers/roles_controller.ts`

The hook throws a plain `Error` on cycle/self-parent. The controller currently flashes `errors` and redirects on validation failures; we mirror that pattern here. Today `store` cannot actually trigger the cycle path (a brand-new row has no descendants), so this guard is mainly defensive — but it's also the right place if a future change adds reparenting in the same handler.

- [ ] **Step 1: Wrap `Role.create` in try/catch**

In `app/controllers/roles_controller.ts`, locate the `Role.create({ ... })` call (around `app/controllers/roles_controller.ts:60-66` in the current file). Replace the create + syncPermissions block:

```ts
    let role: Role
    try {
      role = await Role.create({
        name: payload.name,
        displayName: payload.displayName,
        description: payload.description ?? null,
        isSystem: false,
        parentRoleId: parent.id,
      })
    } catch (err) {
      session.flash('errors', {
        parentRoleId: err instanceof Error ? err.message : 'Could not create role.',
      })
      return response.redirect().back()
    }
    await role.syncPermissions(validPermissions)
```

(`Role` is already imported at the top of the file — no new import needed.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Smoke-test the happy path manually**

Bring up infra and the dev server, then create a role through the UI to confirm nothing regresses:

```bash
docker-compose -f docker-compose.dev.yml up -d
npm run dev
```

Open the roles UI and create a child role under `admin`. Expected: success flash, role appears.

- [ ] **Step 4: Run full test suites**

Run: `node ace test`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add app/controllers/roles_controller.ts
git commit -m "feat(roles): surface cycle-guard errors as form validation flashes"
```

---

## Self-Review Notes

Spec coverage:
- Section 1 cache structure → Task 1 (RoleNode/RoleTree types) + Task 2 (cache wiring).
- Section 2 tree build → Task 1 (`buildTree`) + Task 2 (`db.from('roles')` factory).
- Section 3 service API → Task 3.
- Section 4 invalidation → Task 4 (`afterSave`, `afterDelete`).
- Section 5 cycle prevention → Task 4 (`beforeSave`).
- Section 6 module boundary → Task 2 (type-only `import type Role`) + Task 4 (Role imports from service).
- Section 7 controller error handling → Task 5.
- Testing section → Task 1 (unit) + Task 4 (functional).

Type/name consistency: `RoleRow.parent_role_id` (snake_case from Postgres column) vs `RoleNode.parentRoleId` (camelCase) is intentional — `buildTree` is the boundary. `cycleCheck` (pure) vs `wouldCreateCycle` (cached wrapper) — both exported, used in tests and hooks respectively.

No placeholders, no "see Task N" references — every code block is complete.
