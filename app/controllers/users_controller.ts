import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { updateUserRolesValidator, updateUserAccessValidator } from '#validators/users'
import { ensureRolesAssignable, getUsersViewModel } from '#services/dashboard_view_models'
import { streamStoredObject, IMMUTABLE_PRIVATE } from '#services/file_streaming'
import {
  assignedRoleIds,
  assignableRankedRoleIds,
  hasLivePermission,
  lockRoleOrder,
} from '#services/role_order'
import { audit } from '#services/audit'
import db from '@adonisjs/lucid/services/db'

class RoleAssignmentError extends Error {}
class UserAccessError extends Error {}

export default class UsersController {
  /** GET /system/users — list users in actor's scope */
  async index({ inertia, auth, bouncer }: HttpContext) {
    // Anyone with `users.view` (or owner) gets to see the page; the data
    // returned is already scoped to what the actor is allowed to see.
    await bouncer.authorize('users.view' as never)

    const data = await getUsersViewModel(auth.user!)
    return inertia.render('system/users', data)
  }

  /** GET /users/:id/avatar — stream a user's avatar (self, or with users.view) */
  async avatar({ params, auth, bouncer, response }: HttpContext) {
    if (Number(params.id) !== auth.user!.id) {
      await bouncer.authorize('users.view' as never)
    }
    const user = await User.findOrFail(params.id)
    if (!user.avatarKey) return response.notFound({ error: 'File not found' })
    return streamStoredObject({ response }, user.avatarKey, { cacheControl: IMMUTABLE_PRIVATE })
  }

  /** POST /system/users/:id/roles — change a user's role assignments */
  async updateRoles({ params, request, auth, bouncer, response, session }: HttpContext) {
    const target = await User.findOrFail(params.id)

    // Target-aware authorisation. Encodes:
    //  - no self-edit
    //  - workspace owner is immutable
    //  - actor must hold users.assignRole AND target must be below their rank
    await bouncer.authorize('editUserRoles' as never, target)

    const { roleIds } = await request.validateUsing(updateUserRolesValidator)

    // Final defensive check: every roleId must be assignable to actor.
    // Catches stale rank state and tampering after the policy ran.
    try {
      await ensureRolesAssignable(auth.user!, roleIds)
    } catch (err) {
      session.flash('error', err instanceof Error ? err.message : 'Invalid role assignment.')
      return response.redirect().back()
    }

    try {
      await db.transaction(async (trx) => {
        await lockRoleOrder(trx)
        const currentTarget = await User.query({ client: trx })
          .where('id', target.id)
          .forUpdate()
          .firstOrFail()
        if (
          currentTarget.id === auth.user!.id ||
          currentTarget.isOwner ||
          !(await hasLivePermission(auth.user!, 'users.assignRole', trx))
        ) {
          throw new RoleAssignmentError('You can no longer edit this user’s roles.')
        }
        if (!auth.user!.isOwner) {
          const assignable = new Set(await assignableRankedRoleIds(auth.user!, trx))
          const currentIds = await assignedRoleIds(currentTarget, trx)
          if (currentIds.length === 0 || currentIds.some((id) => !assignable.has(id))) {
            throw new RoleAssignmentError('This user is no longer below your rank.')
          }
        }
        try {
          await ensureRolesAssignable(auth.user!, roleIds, trx)
        } catch (error) {
          throw new RoleAssignmentError(error instanceof Error ? error.message : 'Invalid roles.')
        }
        currentTarget.useTransaction(trx)
        await currentTarget.related('roles').sync(roleIds)
        await audit({
          actor: auth.user!,
          action: 'user.roles.update',
          targetType: 'user',
          targetId: target.id,
          payload: { roleIds },
          trx,
        })
      })
    } catch (err) {
      if (!(err instanceof RoleAssignmentError)) throw err
      session.flash('error', err.message)
      return response.redirect().back()
    }

    session.flash('success', `Roles updated for ${target.email}.`)
    return response.redirect().back()
  }

  /** POST /system/users/:id/access — revoke or restore access without deleting data. */
  async updateAccess({ params, request, auth, bouncer, response, session }: HttpContext) {
    const target = await User.findOrFail(params.id)
    await bouncer.authorize('manageUserAccess' as never, target)
    const { active } = await request.validateUsing(updateUserAccessValidator)

    try {
      await db.transaction(async (trx) => {
        await lockRoleOrder(trx)
        const currentTarget = await User.query({ client: trx })
          .where('id', target.id)
          .forUpdate()
          .firstOrFail()
        if (
          currentTarget.id === auth.user!.id ||
          currentTarget.isOwner ||
          !(await hasLivePermission(auth.user!, 'users.remove', trx))
        ) {
          throw new UserAccessError('You can no longer change this user’s access.')
        }
        if (!auth.user!.isOwner) {
          const assignable = new Set(await assignableRankedRoleIds(auth.user!, trx))
          const currentIds = await assignedRoleIds(currentTarget, trx)
          if (currentIds.length === 0 || currentIds.some((id) => !assignable.has(id))) {
            throw new UserAccessError('This user is no longer below your rank.')
          }
        }
        if (currentTarget.isActive === active) return
        currentTarget.isActive = active
        currentTarget.useTransaction(trx)
        await currentTarget.save()
        await audit({
          actor: auth.user!,
          action: active ? 'user.access.restore' : 'user.access.revoke',
          targetType: 'user',
          targetId: currentTarget.id,
          payload: { active },
          trx,
        })
      })
    } catch (err) {
      if (!(err instanceof UserAccessError)) throw err
      session.flash('error', err.message)
      return response.redirect().back()
    }

    session.flash(
      'success',
      `${active ? 'Access restored' : 'Access revoked'} for ${target.email}.`
    )
    return response.redirect().back()
  }
}
