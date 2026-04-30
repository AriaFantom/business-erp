# Role Hierarchy: Cache Layer + Cycle Prevention

**Date:** 2026-04-30
**Scope:** `app/services/role_hierarchy.ts`, `app/models/role.ts`

## Problem

`app/services/role_hierarchy.ts` runs recursive CTEs (`descendantRoleIds`, `ancestorRoleIds`) on every call. Permission helpers (`assignableRoleIds`, `visibleRoleIds`, `canAssignRole`) call them per-request, so every role-aware authorization check hits Postgres with at least one CTE. Roles change rarely; reads are constant. This does not scale.

Separately, `wouldCreateCycle` exists in the service but is not invoked anywhere. Any code path that sets `roles.parent_role_id` (a future reparent endpoint, a seeder, a migration backfill) can produce a cycle without the application catching it.

## Goal

1. Replace per-request recursive CTEs with one cached, in-memory adjacency list of the role tree.
2. Make a cycle in `roles.parent_role_id` impossible to write through the application by enforcing the check in a model hook that runs for every save.

Out of scope:
- New reparent / role-update HTTP endpoint. The hook protects future endpoints; we don't add one yet.
- Caching anything other than the role tree (user roles, permissions sets, etc.).

## Design

### 1. Cache structure

One snapshot of the entire role tree, stored under a single key.

```ts
type RoleNode = {
  id: number
  parentRoleId: number | null
  name: string         // needed for owner detection in assignableRoleIds
  children: number[]   // computed once at build time
}

type RoleTree = Map<number, RoleNode>
```

**Cache key:** `roles:tree`

**Backing store:** `@adonisjs/cache`'s `default` store (memory L1 + Redis L2, already configured in `config/cache.ts`).

**Serialization:** Redis L2 JSON-serializes values, so `Map` does not round-trip. The `getOrSet` factory returns an array form, and the service rehydrates to `Map<number, RoleNode>` after each read. With ~hundreds of roles this is sub-millisecond.

```ts
type CachedTree = Array<{
  id: number
  parentRoleId: number | null
  name: string
  children: number[]
}>
```

**TTL:** 1 hour. Invalidation is event-driven (Section 4); the TTL is a safety net.

### 2. Tree build

To avoid a circular import between `Role` and the service, the service does **not** import the `Role` model. It loads rows directly via Lucid's query builder:

```ts
const rows = await db
  .from('roles')
  .select('id', 'parent_role_id', 'name')
```

Adjacency list is built in a single pass:

```ts
function buildTree(rows: RoleRow[]): RoleTree {
  const tree: RoleTree = new Map()
  for (const r of rows) {
    tree.set(r.id, { id: r.id, parentRoleId: r.parent_role_id, name: r.name, children: [] })
  }
  for (const node of tree.values()) {
    if (node.parentRoleId !== null) {
      tree.get(node.parentRoleId)?.children.push(node.id)
    }
  }
  return tree
}
```

A row whose `parent_role_id` references a missing parent is treated as a root (parent lookup is a `?.push`, no throw). This matches the existing FK behaviour where `ON DELETE SET NULL` orphans children.

### 3. Service API

`app/services/role_hierarchy.ts` exposes:

```ts
// Internal — cached.
export async function getTree(): Promise<RoleTree>

// In-memory traversals over the cached tree.
export function getDescendants(roleId: number, tree: RoleTree): number[]
export function getAncestors(roleId: number, tree: RoleTree): number[]

// Public, refactored to use getTree() — same signatures as today.
export async function descendantRoleIds(rootIds: number[]): Promise<number[]>
export async function ancestorRoleIds(roleId: number): Promise<number[]>
export async function assignableRoleIds(user: User): Promise<number[]>
export async function visibleRoleIds(user: User): Promise<number[]>
export async function canAssignRole(user: User, role: Role): Promise<boolean>
export async function wouldCreateCycle(roleId: number, newParentId: number | null): Promise<boolean>

// Cache control.
export async function invalidateTreeCache(): Promise<void>
```

`getDescendants` is iterative DFS over `node.children`:

```ts
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
```

`getAncestors` walks `parentRoleId` upward, with a visited guard so a corrupt cycle in cache cannot infinite-loop the process.

`assignableRoleIds` for owners becomes a tree-wide filter (`[...tree.values()].filter(n => n.name !== 'owner').map(n => n.id)`) — no DB query.

`wouldCreateCycle` is rewritten in-memory:

```ts
export async function wouldCreateCycle(roleId: number, newParentId: number | null): Promise<boolean> {
  if (newParentId === null) return false
  if (newParentId === roleId) return true
  const tree = await getTree()
  const descendants = new Set(getDescendants(roleId, tree))
  return descendants.has(newParentId)
}
```

### 4. Cache invalidation

A single key — `roles:tree` — is invalidated on every role write. The invalidation lives on the `Role` model so any caller (controllers, seeders, future ace commands, ad-hoc REPL writes) is covered.

```ts
// app/models/role.ts
import { afterSave, afterDelete } from '@adonisjs/lucid/orm'
import { invalidateTreeCache } from '#services/role_hierarchy'

@afterSave()
static async bustTreeCache() { await invalidateTreeCache() }

@afterDelete()
static async bustTreeCacheOnDelete() { await invalidateTreeCache() }
```

`invalidateTreeCache` is `cache.delete({ key: 'roles:tree' })` — clears L1 and L2.

### 5. Cycle prevention via `Role.beforeSave`

Same file (`app/models/role.ts`):

```ts
@beforeSave()
static async preventCycle(role: Role) {
  if (role.parentRoleId === null || role.parentRoleId === undefined) return

  // Self-parent: descendants are strict, so we must check explicitly.
  if (role.id !== undefined && role.parentRoleId === role.id) {
    throw new Error('Role cannot be its own parent')
  }

  // New rows have no id and no children, so no cycle is possible.
  if (role.id === undefined) return

  // Only re-check when parent actually changed.
  if (role.$dirty.parentRoleId === undefined) return

  const tree = await getTree()
  const descendants = getDescendants(role.id, tree)
  if (descendants.includes(role.parentRoleId)) {
    throw new Error('Cycle detected in role hierarchy')
  }
}
```

Notes:
- The hook runs for every `Role.create` / `role.save()`, including future controllers, seeders, and the `db:seed` runner. There is no application path that sets `parent_role_id` without going through it.
- For brand-new roles `role.id` is `undefined` and the hook short-circuits. A new role has no descendants, so no cycle is possible by construction.
- Non-`parentRoleId` updates skip the tree fetch via the `$dirty` check.
- Throwing aborts the save; controllers already redirect on validation failure but should also catch this and flash a friendly error (see Section 7).

### 6. Imports and module boundary

- `app/services/role_hierarchy.ts` does **not** import `#models/role`. It uses `db.from('roles')` for the snapshot.
- `app/models/role.ts` imports `getTree`, `getDescendants`, and `invalidateTreeCache` from `#services/role_hierarchy`.
- `app/services/role_hierarchy.ts` still needs the `Role` *type* in two places (`canAssignRole(user, role: Role)`, signatures in tests). Use `import type Role from '#models/role'` — type-only imports are erased at compile time and do not create a runtime cycle.
- `User` parameter remains `import type User from '#models/user'`.

### 7. Controller error handling

`RolesController.store` currently flashes validation errors and redirects back. The `beforeSave` hook throws a plain `Error`. Update the controller to wrap the `Role.create` call in a try/catch, flash `errors.parentRoleId = err.message`, and redirect back. (Same pattern goes in `destroy` if a future change starts touching `parent_role_id` there, but `destroy` does not currently mutate parents.)

This is the only controller change. The reparent path does not exist yet.

## Testing

Unit tests under `tests/unit/services/role_hierarchy.spec.ts`:

- `buildTree` produces a complete adjacency list for a small fixture (root → A → B, root → C).
- `getDescendants` returns strict descendants in DFS order; missing root → empty.
- `getDescendants` does not infinite-loop on a corrupted tree where `children` references a missing id.
- `getAncestors` walks up, excludes self, terminates on null.
- `wouldCreateCycle` returns `true` for self-parent, true for parent-in-subtree, false for sibling, false for unrelated, false for `null`.
- `assignableRoleIds` for owner excludes the `owner` role itself; for non-owner returns descendants.

Functional tests under `tests/functional/roles/cycle_guard.spec.ts`:

- Saving a `Role` with `parentRoleId === id` throws.
- Reparenting role A under one of its own descendants throws.
- Creating a fresh role under any existing parent succeeds (regression: hook does not block creates).
- After `Role.create(...)`, the cached tree contains the new node (cache invalidation happened).
- After `role.delete()`, the cached tree no longer contains the node.

The functional suite already runs against a real Postgres + Redis (per CLAUDE.md), so cache invalidation is exercised end-to-end.

## Performance expectations

- Steady state: every authorization check resolves from L1 memory in O(roles) traversal, no Postgres round-trip. For ~hundreds of roles this is microseconds.
- Cold cache (process start, post-invalidation): one `SELECT id, parent_role_id, name FROM roles` query, then served from cache.
- Role write: one extra `cache.delete` (Redis `DEL`).

## Migration notes

- No DB schema change. Existing `parent_role_id` column and FK stay as-is.
- Existing CTE-based code paths in `role_hierarchy.ts` are replaced wholesale; public function signatures are preserved so callers (`RolesController`, `dashboard_controller`, transformers, abilities) need no changes other than the controller try/catch in Section 7.
