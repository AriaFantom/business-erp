import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'
import Role from '#models/role'
import Invitation from '#models/invitation'
import { DateTime } from 'luxon'
import string from '@adonisjs/core/helpers/string'

/**
 * Runs before /dashboard (and other authenticated routes).
 * If there are zero users, generates a one-time "setup" invitation
 * and redirects the visitor to /invite/<token> so they can create
 * the owner account.
 */
export default class FirstUserSetupMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const result = await User.query().count('* as total').first()
    const hasUsers = Number(result?.$extras.total ?? 0) > 0

    if (hasUsers) return next()

    // Reuse a still-pending setup invitation if one already exists.
    let setup = await Invitation.query()
      .where('type', 'setup')
      .where('status', 'pending')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .first()

    if (!setup) {
      const ownerRole = await Role.findBy('name', 'owner')
      if (!ownerRole) {
        // Seeder hasn't run; bail loudly rather than redirect-loop.
        return ctx.response
          .status(500)
          .send('Server not seeded: missing "owner" role. Run `node ace db:seed`.')
      }

      setup = await Invitation.create({
        email: null,
        token: string.random(64),
        roleId: ownerRole.id,
        invitedBy: null,
        type: 'setup',
        status: 'pending',
        expiresAt: DateTime.now().plus({ hours: 24 }),
      })
    }

    return ctx.response.redirect(`/invite/${setup.token}`)
  }
}
