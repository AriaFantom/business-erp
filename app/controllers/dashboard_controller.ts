import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Invitation from '#models/invitation'
import { DateTime } from 'luxon'
import { permissions } from '#start/permissions'
import { effectivePriority } from '#services/role_hierarchy'

export default class DashboardController {
  async index({ inertia, auth }: HttpContext) {
    const user = auth.user!
    const myPriority = await effectivePriority(user)
    const myPermissions = user.isOwner
      ? new Set(permissions.active())
      : new Set(await user.getPermissions())

    const [roles, pendingInvitations] = await Promise.all([
      Role.query().orderBy('priority', 'desc').orderBy('name', 'asc'),
      Invitation.query()
        .where('status', 'pending')
        .where('expires_at', '>', DateTime.now().toSQL()!)
        .preload('role')
        .orderBy('created_at', 'desc'),
    ])

    return inertia.render('dashboard', {
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        description: r.description,
        isSystem: r.isSystem,
        priority: r.priority,
        permissions: r.permissions ?? [],
        // The owner role is reserved and never assignable from the UI;
        // everything else must be strictly below the current user's level.
        assignable: r.name !== 'owner' && r.priority < myPriority,
      })),
      pendingInvitations: pendingInvitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role?.displayName ?? '—',
        type: i.type as 'setup' | 'invite',
        expiresAt: i.expiresAt.toISO(),
      })),
      // Only surface permissions the current user actually holds, so the
      // create-role UI can't even offer escalation paths to non-owners.
      permissionCatalog: permissions
        .all()
        .filter((p) => myPermissions.has(p.key))
        .map((p) => ({ key: p.key, description: p.description })),
    })
  }
}
