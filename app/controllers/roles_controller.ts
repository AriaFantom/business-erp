import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Invitation from '#models/invitation'
import { createRoleValidator, reorderRolesValidator } from '#validators/role'
import { permissions } from '#start/permissions'
import { getRolesViewModel } from '#services/dashboard_view_models'
import {
  assignedRoleIds,
  hasLivePermission,
  highestRolePosition,
  lockRoleOrder,
  rankedRoles,
} from '#services/role_order'
import { audit } from '#services/audit'
import db from '@adonisjs/lucid/services/db'

const RESERVED_NAMES = new Set(['owner'])
class RoleChangeError extends Error {}

export default class RolesController {
  /** GET /system/roles — ranked roles + create-role form */
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

    const validPermissions = permissions.filterKeys(payload.permissions ?? [])

    try {
      await db.transaction(async (trx) => {
        await lockRoleOrder(trx)
        if (!(await hasLivePermission(auth.user!, 'roles.create', trx))) {
          throw new RoleChangeError('You no longer have permission to create roles.')
        }
        if (!auth.user!.isOwner) {
          const ownIds = await assignedRoleIds(auth.user!, trx)
          const ownRoles = await Role.query({ client: trx }).whereIn('id', ownIds)
          const myKeys = new Set(ownRoles.flatMap((item) => item.permissions ?? []))
          if (validPermissions.some((key) => !myKeys.has(key))) {
            throw new RoleChangeError('You cannot grant permissions you do not hold.')
          }
        }
        const existingRoles = await rankedRoles(trx)
        const role = new Role()
        role.useTransaction(trx)
        role.merge({
          name: payload.name,
          displayName: payload.displayName,
          description: payload.description ?? null,
          isSystem: false,
          parentRoleId: null,
          rankPosition: existingRoles.length,
          permissions: validPermissions,
        })
        await role.save()
        await audit({
          actor: auth.user!,
          action: 'role.create',
          targetType: 'role',
          targetId: role.id,
          trx,
        })
      })
    } catch (error) {
      if (!(error instanceof RoleChangeError)) throw error
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Role "${payload.displayName}" created.`)
    return response.redirect().back()
  }

  /** POST /roles/reorder — save one complete, current highest-first ordering. */
  async reorder({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('roles.update' as never)
    const { orderedIds, originalIds } = await request.validateUsing(reorderRolesValidator)
    const actor = auth.user!
    const rejection = await db.transaction(async (trx) => {
      await lockRoleOrder(trx)
      if (!(await hasLivePermission(actor, 'roles.update', trx))) {
        return 'You no longer have permission to reorder roles.'
      }
      const roles = await rankedRoles(trx)
      const currentIds = roles.map((role) => role.id)
      if (
        originalIds.length !== currentIds.length ||
        originalIds.some((id, i) => id !== currentIds[i])
      ) {
        return 'The role order changed. Reload the page and try again.'
      }
      if (
        orderedIds.length !== currentIds.length ||
        new Set(orderedIds).size !== currentIds.length ||
        orderedIds.some((id) => !currentIds.includes(id))
      ) {
        return 'The role order must contain every role exactly once.'
      }
      const owner = roles.find((role) => role.name === 'owner')
      if (!owner || orderedIds[0] !== owner.id) return 'Owner must remain the highest role.'

      if (!actor.isOwner) {
        const highest = await highestRolePosition(actor, roles, trx)
        if (highest === null) return 'You have no role to manage from.'
        const ownIds = new Set(await assignedRoleIds(actor, trx))
        if (
          roles.some(
            (role, index) =>
              (role.rankPosition <= highest || ownIds.has(role.id)) && orderedIds[index] !== role.id
          )
        )
          return 'You can only reorder roles below your own; your roles must stay fixed.'
      }

      for (const [position, id] of orderedIds.entries()) {
        if (id !== currentIds[position]) {
          await trx.from('roles').where('id', id).update({ rank_position: position })
        }
      }
      if (orderedIds.some((id, index) => id !== currentIds[index])) {
        await audit({
          actor,
          action: 'role.reorder',
          targetType: 'role',
          payload: { before: currentIds, after: orderedIds },
          trx,
        })
      }
      return null
    })
    session.flash(rejection ? 'error' : 'success', rejection ?? 'Role order saved.')
    return response.redirect().back()
  }

  /** POST /roles/:id/delete (form-friendly destroy) */
  async destroy({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('roles.delete' as never)

    let deletedName: string
    try {
      deletedName = await db.transaction(async (trx) => {
        await lockRoleOrder(trx)
        if (!(await hasLivePermission(auth.user!, 'roles.delete', trx))) {
          throw new RoleChangeError('You no longer have permission to delete roles.')
        }
        const current = await rankedRoles(trx)
        const target = current.find((item) => item.id === Number(params.id))
        if (!target) throw new RoleChangeError('Role not found.')
        if (target.isSystem) throw new RoleChangeError('System roles cannot be deleted.')
        const highest = await highestRolePosition(auth.user!, current, trx)
        if (highest === null || target.rankPosition <= highest) {
          throw new RoleChangeError('You can only delete roles below your own.')
        }
        const referenced = await Invitation.query({ client: trx })
          .where('role_id', target.id)
          .first()
        if (referenced)
          throw new RoleChangeError(
            'This role is referenced by invitation history and cannot be deleted.'
          )
        target.useTransaction(trx)
        await target.delete()
        const remaining = current.filter((item) => item.id !== target.id)
        for (const [position, item] of remaining.entries()) {
          await trx.from('roles').where('id', item.id).update({ rank_position: position })
        }
        await audit({
          actor: auth.user!,
          action: 'role.delete',
          targetType: 'role',
          targetId: target.id,
          trx,
        })
        return target.displayName
      })
    } catch (error) {
      if (!(error instanceof RoleChangeError)) throw error
      session.flash('error', error.message)
      return response.redirect().back()
    }
    session.flash('success', `Role "${deletedName}" deleted.`)
    return response.redirect().back()
  }
}
