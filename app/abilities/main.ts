import { Bouncer } from '@adonisjs/bouncer'
import type User from '#models/user'
import ResourceGrant from '#models/resource_grant'
import { DateTime } from 'luxon'
import { assignableRoleIds } from '#services/role_hierarchy'
import { assignedRoleIds } from '#services/role_order'

/**
 * Quick check used by other abilities to short-circuit owners.
 */
export const isOwner = Bouncer.ability((user: User) => user.isOwner)

/**
 * Whether `actor` may edit the role assignments of `target`.
 *
 * Hard rules (defence in depth — also enforced server-side at write time):
 *  - actor cannot edit themselves (lockout risk)
 *  - workspace owner is immutable through this surface
 *  - non-owners need users.assignRole AND target's existing roles must all
 *    be below the actor's highest assigned role
 */
export const editUserRoles = Bouncer.ability(async (actor: User, target: User) => {
  if (target.id === actor.id) return false
  if (target.isOwner) return false
  if (actor.isOwner) return true

  const perms = await actor.getPermissions()
  if (!perms.includes('users.assignRole')) return false

  const assignable = new Set(await assignableRoleIds(actor))
  const targetRoles = await assignedRoleIds(target)
  if (targetRoles.length === 0) return false
  return targetRoles.every((id) => assignable.has(id))
})

/** Revoke or restore access only for another, non-owner user below the actor. */
export const manageUserAccess = Bouncer.ability(async (actor: User, target: User) => {
  if (target.id === actor.id || target.isOwner) return false
  if (actor.isOwner) return true
  const actorPermissions = await actor.getPermissions()
  if (!actorPermissions.includes('users.remove')) return false

  const assignable = new Set(await assignableRoleIds(actor))
  const targetRoles = await assignedRoleIds(target)
  return targetRoles.length > 0 && targetRoles.every((id) => assignable.has(id))
})

/**
 * ABAC fallback: per-resource grant.
 *
 * Example:
 *   await bouncer.authorize('accessResourceGrant', 'Inventory', item.id, 'update')
 */
export const accessResourceGrant = Bouncer.ability(
  async (user: User, resourceType: string, resourceId: string, action: string) => {
    if (user.isOwner) return true

    const grant = await ResourceGrant.query()
      .where('user_id', user.id)
      .where('resource_type', resourceType)
      .where('resource_id', resourceId)
      .where((q) => q.whereNull('expires_at').orWhere('expires_at', '>', DateTime.now().toSQL()!))
      .first()

    if (!grant) return false
    return grant.actions.includes(action)
  }
)
