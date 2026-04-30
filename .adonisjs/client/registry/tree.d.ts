/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  invitation: {
    show: typeof routes['invitation.show']
    store: typeof routes['invitation.store']
  }
  dashboard: typeof routes['dashboard']
  invitations: {
    store: typeof routes['invitations.store']
    resend: typeof routes['invitations.resend']
    revoke: typeof routes['invitations.revoke']
  }
  roles: {
    store: typeof routes['roles.store']
    destroy: typeof routes['roles.destroy']
  }
}
