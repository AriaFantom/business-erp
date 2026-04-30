import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Invitation from '#models/invitation'
import { createRoleValidator } from '#validators/role'
import { permissions } from '#start/permissions'
import { effectivePriority } from '#services/role_hierarchy'

const RESERVED_NAMES = new Set(['owner'])

export default class RolesController {
  /** POST /roles */
  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('roles.create' as never)

    const payload = await request.validateUsing(createRoleValidator)

    if (RESERVED_NAMES.has(payload.name)) {
      session.flash('errors', { name: `"${payload.name}" is a reserved role name.` })
      return response.redirect().back()
    }

    const existing = await Role.findBy('name', payload.name)
    if (existing) {
      session.flash('errors', { name: 'A role with this name already exists.' })
      return response.redirect().back()
    }

    // Hierarchy: a creator can only define a role strictly below their own level.
    const myPriority = await effectivePriority(auth.user!)
    if (payload.priority >= myPriority) {
      session.flash('errors', {
        priority: 'Role priority must be below your own.',
      })
      return response.redirect().back()
    }

    const validPermissions = permissions.filterKeys(payload.permissions ?? [])

    // Subset rule: cannot grant permissions you do not hold yourself.
    if (!auth.user!.isOwner) {
      const myKeys = new Set(await auth.user!.getPermissions())
      const overstep = validPermissions.filter((k) => !myKeys.has(k))
      if (overstep.length > 0) {
        session.flash('errors', {
          permissions: `You cannot grant permissions you do not hold: ${overstep.join(', ')}`,
        })
        return response.redirect().back()
      }
    }

    const role = await Role.create({
      name: payload.name,
      displayName: payload.displayName,
      description: payload.description ?? null,
      isSystem: false,
      priority: payload.priority,
    })
    await role.syncPermissions(validPermissions)

    session.flash('success', `Role "${payload.displayName}" created.`)
    return response.redirect().back()
  }

  /** POST /roles/:id/delete (form-friendly destroy) */
  async destroy({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('roles.delete' as never)

    const role = await Role.find(params.id)
    if (!role) {
      session.flash('error', 'Role not found.')
      return response.redirect().back()
    }
    if (role.isSystem) {
      session.flash('error', 'System roles cannot be deleted.')
      return response.redirect().back()
    }

    const myPriority = await effectivePriority(auth.user!)
    if (role.priority >= myPriority) {
      session.flash('error', 'You cannot delete a role at or above your own.')
      return response.redirect().back()
    }

    // The invitations table references roles with ON DELETE RESTRICT,
    // so a role with pending invites cannot be removed without cleanup.
    const pendingInvites = await Invitation.query()
      .where('role_id', role.id)
      .where('status', 'pending')
      .first()
    if (pendingInvites) {
      session.flash('error', 'Revoke pending invitations using this role before deleting it.')
      return response.redirect().back()
    }

    await role.delete()
    session.flash('success', `Role "${role.displayName}" deleted.`)
    return response.redirect().back()
  }
}
