import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Invitation from '#models/invitation'
import { DateTime } from 'luxon'

export default class DashboardController {
  async index({ inertia }: HttpContext) {
    const [roles, pendingInvitations] = await Promise.all([
      Role.query().orderBy('name', 'asc'),
      Invitation.query()
        .where('status', 'pending')
        .where('expires_at', '>', DateTime.now().toSQL()!)
        .preload('role')
        .orderBy('created_at', 'desc'),
    ])

    return inertia.render('dashboard', {
      roles: roles.map((r) => ({ id: r.id, name: r.name, displayName: r.displayName })),
      pendingInvitations: pendingInvitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role?.displayName ?? '—',
        type: i.type as 'setup' | 'invite',
        expiresAt: i.expiresAt.toISO(),
      })),
    })
  }
}
