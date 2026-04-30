import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Invitation from '#models/invitation'
import { DateTime } from 'luxon'
import { permissions } from '#start/permissions'
import { assignableRoleIds } from '#services/role_hierarchy'

export default class DashboardController {
  async index({ inertia, auth }: HttpContext) {
    const user = auth.user!
    const myPermissions = user.isOwner
      ? new Set(permissions.active())
      : new Set(await user.getPermissions())

    const [roles, pendingInvitations, assignable] = await Promise.all([
      Role.query().orderBy('name', 'asc'),
      Invitation.query()
        .where('status', 'pending')
        .where('expires_at', '>', DateTime.now().toSQL()!)
        .preload('role')
        .orderBy('created_at', 'desc'),
      assignableRoleIds(user),
    ])

    const assignableSet = new Set(assignable)

    return inertia.render('dashboard', {
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        description: r.description,
        isSystem: r.isSystem,
        parentRoleId: r.parentRoleId,
        permissions: r.permissions ?? [],
        // Precomputed by the recursive CTE on the server, so the UI never
        // needs to second-guess hierarchy rules.
        assignable: assignableSet.has(r.id),
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
