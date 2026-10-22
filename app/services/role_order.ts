import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Role from '#models/role'
import type User from '#models/user'

/** Shared lock serializes changes to ordering and role assignments. */
export async function lockRoleOrder(trx: TransactionClientContract): Promise<void> {
  await trx.rawQuery('SELECT pg_advisory_xact_lock(179000, 1)')
}

export async function rankedRoles(trx?: TransactionClientContract): Promise<Role[]> {
  return Role.query({ client: trx }).orderBy('rank_position', 'asc').orderBy('id', 'asc')
}

export async function assignedRoleIds(
  actor: User,
  trx?: TransactionClientContract
): Promise<number[]> {
  const query = trx ?? db
  const rows = await query.from('user_roles').where('user_id', actor.id).select('role_id')
  return rows.map((row) => Number(row.role_id))
}

/** Read feature permission from the current pivot and role rows, not preloaded user state. */
export async function hasLivePermission(
  actor: User,
  permission: string,
  trx: TransactionClientContract
): Promise<boolean> {
  if (actor.isOwner) return true
  const ids = await assignedRoleIds(actor, trx)
  if (ids.length === 0) return false
  const roles = await Role.query({ client: trx }).whereIn('id', ids)
  return roles.some((role) => role.permissions?.includes(permission))
}

export async function highestRolePosition(
  actor: User,
  roles: Role[],
  trx?: TransactionClientContract
): Promise<number | null> {
  if (actor.isOwner) return -1
  const assigned = new Set(await assignedRoleIds(actor, trx))
  const positions = roles.filter((role) => assigned.has(role.id)).map((role) => role.rankPosition)
  return positions.length ? Math.min(...positions) : null
}

export async function assignableRankedRoleIds(
  actor: User,
  trx?: TransactionClientContract
): Promise<number[]> {
  const roles = await rankedRoles(trx)
  const highest = await highestRolePosition(actor, roles, trx)
  if (highest === null) return []
  return roles
    .filter((role) => role.name !== 'owner' && role.rankPosition > highest)
    .map((role) => role.id)
}
