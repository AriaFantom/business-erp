import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Invitation from '#models/invitation'
import { createRoleValidator } from '#validators/role'
import { permissions } from '#start/permissions'
import { canAssignRole } from '#services/role_hierarchy'
import { getRolesViewModel } from '#services/dashboard_view_models'

const RESERVED_NAMES = new Set(['owner'])

export default class RolesController {
  /** GET /system/roles — role tree + create-role form */
  async index({ inertia, auth, bouncer }: HttpContext) {
    await bouncer.authorize('roles.view' as never)
    const data = await getRolesViewModel(auth.user!)
    return inertia.render('system/roles', data)
  }

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

    // The new role must hang off a parent the user is allowed to extend.
    // "Allowed to extend" = the parent must be assignable to the user, which
    // covers descendants of their own roles (and excludes 'owner').
    const parent = await Role.find(payload.parentRoleId)
    if (!parent) {
      session.flash('errors', { parentRoleId: 'Parent role not found.' })
      return response.redirect().back()
    }
    if (!(await canAssignRole(auth.user!, parent)) && !auth.user!.isOwner) {
      session.flash('errors', {
        parentRoleId: 'You can only attach new roles below your own.',
      })
      return response.redirect().back()
    }
    // Owners can attach anywhere except under the reserved 'owner' role itself
    // wait — they CAN attach under owner; that's exactly how the seeded admin
    // role is structured. So no extra owner-side restriction.

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

    let role: Role
    try {
      role = await Role.create({
        name: payload.name,
        displayName: payload.displayName,
        description: payload.description ?? null,
        isSystem: false,
        parentRoleId: parent.id,
      })
    } catch (err) {
      // Only handle the Role beforeSave cycle guard. Anything else
      // (DB constraint, cache failure, etc.) should bubble up so the
      // user sees a proper error rather than a misleading parent-role flash.
      const msg = err instanceof Error ? err.message : ''
      if (/own parent|Cycle detected in role hierarchy/.test(msg)) {
        session.flash('errors', { parentRoleId: msg })
        return response.redirect().back()
      }
      throw err
    }
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

    if (!(await canAssignRole(auth.user!, role))) {
      session.flash('error', 'You can only delete roles below your own.')
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

    // FK on parent_role_id is ON DELETE SET NULL, so children get reparented
    // to the forest root. Callers should be aware of this; the system roles
    // are protected above.
    await role.delete()
    session.flash('success', `Role "${role.displayName}" deleted.`)
    return response.redirect().back()
  }
}
