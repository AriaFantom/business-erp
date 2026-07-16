import type { HttpContext } from '@adonisjs/core/http'
import { updateProfileValidator, updateAvatarValidator } from '#validators/profile'
import { storeAvatar, removeAvatar } from '#services/avatar_storage'
import { streamStoredObject, IMMUTABLE_PRIVATE } from '#services/file_streaming'

export default class ProfileController {
  /** GET /profile */
  async show({ inertia }: HttpContext) {
    return inertia.render('profile/edit', {})
  }

  /** GET /profile/avatar — stream the current user's avatar */
  async avatar({ auth, response }: HttpContext) {
    const user = auth.user!
    if (!user.avatarKey) return response.notFound({ error: 'File not found' })
    return streamStoredObject({ response }, user.avatarKey, { cacheControl: IMMUTABLE_PRIVATE })
  }

  /** POST /profile — update first/last name */
  async update({ request, auth, response, session }: HttpContext) {
    const payload = await request.validateUsing(updateProfileValidator)
    const user = auth.user!

    user.firstName = payload.firstName
    user.lastName = payload.lastName
    await user.save()

    session.flash('success', 'Profile updated.')
    return response.redirect().back()
  }

  /** POST /profile/avatar — upload or replace avatar */
  async updateAvatar({ request, auth, response, session }: HttpContext) {
    const payload = await request.validateUsing(updateAvatarValidator)
    await storeAvatar(auth.user!, payload.avatar)

    session.flash('success', 'Avatar updated.')
    return response.redirect().back()
  }

  /** POST /profile/avatar/delete — remove avatar */
  async destroyAvatar({ auth, response, session }: HttpContext) {
    await removeAvatar(auth.user!)
    session.flash('success', 'Avatar removed.')
    return response.redirect().back()
  }
}
