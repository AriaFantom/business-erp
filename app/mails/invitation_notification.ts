import { BaseMail } from '@adonisjs/mail'
import type Invitation from '#models/invitation'

export default class InvitationNotification extends BaseMail {
  subject = 'You have been invited'

  constructor(private invitation: Invitation) {
    super()
  }

  prepare() {
    const url = `/invite/${this.invitation.token}`
    if (this.invitation.email) {
      this.message.to(this.invitation.email)
    }
    this.message.html(
      `<p>You have been invited to join.</p><p><a href="${url}">Accept invitation</a></p>`
    )
  }
}
