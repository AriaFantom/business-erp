import db from '@adonisjs/lucid/services/db'
import cache from '@adonisjs/cache/services/main'
import type Role from '#models/role'
import type User from '#models/user'

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
    return [...tree.values()].filter((n) => n.name !== OWNER_ROLE_NAME).map((n) => n.id)
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
      if (!result.has(child) && tree.has(child)) {
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

export function cycleCheck(roleId: number, newParentId: number | null, tree: RoleTree): boolean {
  if (newParentId === null) return false
  if (newParentId === roleId) return true
  return new Set(getDescendants(roleId, tree)).has(newParentId)
}

// --- Cache layer ---

const TREE_CACHE_KEY = 'roles:tree'

export async function getTree(): Promise<RoleTree> {
  const rows = await cache.getOrSet({
    key: TREE_CACHE_KEY,
    ttl: '1h',
    factory: async () => {
      const result = await db.from('roles').select('id', 'parent_role_id', 'name')
      return result as RoleRow[]
    },
  })
  return buildTree(rows)
}

export async function invalidateTreeCache(): Promise<void> {
  await cache.delete({ key: TREE_CACHE_KEY })
}
