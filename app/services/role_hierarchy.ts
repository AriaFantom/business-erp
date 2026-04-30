import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import type User from '#models/user'

/**
 * Tree-based role hierarchy backed by `roles.parent_role_id` and a handful
 * of recursive CTEs. Owners bypass the tree entirely and are allowed to
 * touch every non-owner role.
 *
 * Semantics
 * ---------
 *  - "Strict descendants of R" = every role reachable from R via parent_role_id,
 *    excluding R itself. A user can act on those roles.
 *  - A user can NOT act on their own roles, siblings, or anything above them.
 *  - The role named 'owner' is reserved: never assignable through the UI,
 *    not even by other owners (it's set only via the setup invitation).
 */

const OWNER_ROLE_NAME = 'owner'

async function userRoleIds(user: User): Promise<number[]> {
  const roles = await user.getRoles()
  return roles.map((r) => r.id)
}

/**
 * Returns the strict descendants of the given root role IDs.
 * Empty input → empty output.
 */
export async function descendantRoleIds(rootIds: number[]): Promise<number[]> {
  if (rootIds.length === 0) return []
  const result = await db.rawQuery(
    `
    WITH RECURSIVE descendants AS (
      SELECT id, parent_role_id
        FROM roles
       WHERE parent_role_id = ANY(?)
      UNION ALL
      SELECT r.id, r.parent_role_id
        FROM roles r
        JOIN descendants d ON r.parent_role_id = d.id
    )
    SELECT id FROM descendants
    `,
    [rootIds]
  )
  return (result.rows as Array<{ id: number }>).map((row) => row.id)
}

/**
 * Returns the strict ancestors of the given role (walking up via parent_role_id).
 */
export async function ancestorRoleIds(roleId: number): Promise<number[]> {
  const result = await db.rawQuery(
    `
    WITH RECURSIVE ancestors AS (
      SELECT r.id, r.parent_role_id
        FROM roles r
       WHERE r.id = ?
      UNION ALL
      SELECT r.id, r.parent_role_id
        FROM roles r
        JOIN ancestors a ON r.id = a.parent_role_id
    )
    SELECT id FROM ancestors WHERE id <> ?
    `,
    [roleId, roleId]
  )
  return (result.rows as Array<{ id: number }>).map((row) => row.id)
}

/**
 * Set of role IDs the user is allowed to assign / delete / re-parent.
 * Owners get every non-owner role; everyone else gets the descendants of
 * their own roles (which excludes their roles themselves and anything above).
 */
export async function assignableRoleIds(user: User): Promise<number[]> {
  if (user.isOwner) {
    const rows = await Role.query().whereNot('name', OWNER_ROLE_NAME).select('id')
    return rows.map((r) => r.id)
  }
  return descendantRoleIds(await userRoleIds(user))
}

export async function canAssignRole(user: User, role: Role): Promise<boolean> {
  if (role.name === OWNER_ROLE_NAME) return false
  if (user.isOwner) return true
  const ids = new Set(await assignableRoleIds(user))
  return ids.has(role.id)
}

/**
 * True when re-parenting `roleId` under `newParentId` would create a cycle —
 * i.e. when `newParentId` is `roleId` itself or sits inside its subtree.
 */
export async function wouldCreateCycle(
  roleId: number,
  newParentId: number | null
): Promise<boolean> {
  if (newParentId === null) return false
  if (newParentId === roleId) return true
  const subtree = new Set([roleId, ...(await descendantRoleIds([roleId]))])
  return subtree.has(newParentId)
}

/**
 * Returns the role IDs that belong to the user's "domain": the user's own
 * roles plus every descendant. Useful when computing things the UI should
 * be allowed to *see* (vs. assign).
 */
export async function visibleRoleIds(user: User): Promise<number[]> {
  if (user.isOwner) {
    const rows = await Role.query().select('id')
    return rows.map((r) => r.id)
  }
  const own = await userRoleIds(user)
  const desc = await descendantRoleIds(own)
  return [...new Set([...own, ...desc])]
}
