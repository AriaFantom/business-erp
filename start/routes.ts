/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

const InvitationsController = () => import('#controllers/invitations_controller')
const AcceptInvitationController = () => import('#controllers/auth/invitations_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const RolesController = () => import('#controllers/roles_controller')
const ProfileController = () => import('#controllers/profile_controller')
const UsersController = () => import('#controllers/users_controller')

router.on('/').renderInertia('home', {}).use(middleware.firstUserSetup()).as('home')

router
  .group(() => {
    router.get('login', [controllers.Session, 'create']).as('session.create')
    router.post('login', [controllers.Session, 'store']).as('session.store')
    router.get('invite/:token', [AcceptInvitationController, 'show']).as('invitation.show')
    router.post('invite/:token', [AcceptInvitationController, 'store']).as('invitation.store')
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy']).as('session.destroy')
    router.get('dashboard', [DashboardController, 'index']).as('dashboard')

    // System area: nav links from the sidebar resolve here. Each route is
    // gated server-side by the same permission as its sidebar nav item.
    router.get('system/roles', [RolesController, 'index']).as('system.roles')
    router.get('system/invitations', [InvitationsController, 'index']).as('system.invitations')
    router.get('system/users', [UsersController, 'index']).as('system.users')
    router
      .post('system/users/:id/roles', [UsersController, 'updateRoles'])
      .as('system.users.update_roles')

    router.post('invitations', [InvitationsController, 'store']).as('invitations.store')
    router
      .post('invitations/:id/resend', [InvitationsController, 'resend'])
      .as('invitations.resend')
    router
      .post('invitations/:id/revoke', [InvitationsController, 'revoke'])
      .as('invitations.revoke')
    router.post('roles', [RolesController, 'store']).as('roles.store')
    router.post('roles/:id/delete', [RolesController, 'destroy']).as('roles.destroy')
    router.get('profile', [ProfileController, 'show']).as('profile.show')
    router.post('profile', [ProfileController, 'update']).as('profile.update')
    router.post('profile/avatar', [ProfileController, 'updateAvatar']).as('profile.avatar.update')
    router
      .post('profile/avatar/delete', [ProfileController, 'destroyAvatar'])
      .as('profile.avatar.destroy')
  })
  .use(middleware.auth())
