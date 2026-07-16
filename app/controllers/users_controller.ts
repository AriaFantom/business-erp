import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { updateUserRolesValidator } from '#validators/users'
import { ensureRolesAssignable, getUsersViewModel } from '#services/dashboard_view_models'
import { streamStoredObject, IMMUTABLE_PRIVATE } from '#services/file_streaming'

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
    //  - actor must hold users.assignRole AND target must be inside subtree
    await bouncer.authorize('editUserRoles' as never, target)

    const { roleIds } = await request.validateUsing(updateUserRolesValidator)

    // Final defensive check: every roleId must be assignable to actor.
    // Catches stale subtree state and tampering after the policy ran.
    try {
      await ensureRolesAssignable(auth.user!, roleIds)
    } catch (err) {
      session.flash('error', err instanceof Error ? err.message : 'Invalid role assignment.')
      return response.redirect().back()
    }

    await target.related('roles').sync(roleIds)

    session.flash('success', `Roles updated for ${target.email}.`)
    return response.redirect().back()
  }
}
