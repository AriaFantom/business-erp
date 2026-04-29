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
    router.post('invitations', [InvitationsController, 'store']).as('invitations.store')
  })
  .use(middleware.auth())
