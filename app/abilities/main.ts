import { Bouncer } from '@adonisjs/bouncer'
import type User from '#models/user'
import ResourceGrant from '#models/resource_grant'
import { DateTime } from 'luxon'

/**
 * Quick check used by other abilities to short-circuit owners.
 */
export const isOwner = Bouncer.ability((user: User) => user.isOwner)

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
