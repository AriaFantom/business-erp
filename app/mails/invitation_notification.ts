import { BaseMail } from '@adonisjs/mail'
import { appUrl } from '#config/app'
import type Invitation from '#models/invitation'

export default class InvitationNotification extends BaseMail {
  subject: string

  constructor(private invitation: Invitation) {
    super()
    this.subject = invitation.type === 'setup' ? 'Set up your account' : 'You have been invited'
  }

  prepare() {
    const acceptUrl = new URL(`/invite/${this.invitation.token}`, appUrl).toString()
    const isSetup = this.invitation.type === 'setup'
    const roleName = this.invitation.role?.displayName ?? null

    if (this.invitation.email) {
      this.message.to(this.invitation.email)
    }

    this.message.htmlView('emails/invitation', {
      heading: isSetup ? 'Set up the workspace' : 'You have been invited',
      intro: isSetup
        ? 'Use the button below to create the first owner account for the workspace.'
        : `You have been invited to join${roleName ? ` as ${roleName}` : ''}. Click the button below to accept and set up your account.`,
      ctaLabel: isSetup ? 'Set up account' : 'Accept invitation',
      acceptUrl,
      roleName,
      expiresAt: this.invitation.expiresAt.toFormat('LLL d, yyyy'),
      year: new Date().getFullYear(),
    })
  }
}
