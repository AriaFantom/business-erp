import { BaseMail } from '@adonisjs/mail'
import { appUrl } from '#config/app'
import type Invitation from '#models/invitation'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import { getDashboardBranding } from '#services/dashboard_branding'
import env from '#start/env'

export default class InvitationNotification extends BaseMail {
  subject: string

  constructor(private invitation: Invitation) {
    super()
    this.subject = invitation.type === 'setup' ? 'Set up your account' : 'You have been invited'
  }

  async prepare() {
    const acceptUrl = new URL(`/invite/${this.invitation.token}`, appUrl).toString()
    const isSetup = this.invitation.type === 'setup'
    const roleName = this.invitation.role?.displayName ?? null
    const branding = await getDashboardBranding()
    let brandIconCid: string | null = null

    this.subject = isSetup
      ? `Set up your ${branding.name} account`
      : `You have been invited to ${branding.name}`
    this.message.subject(this.subject)
    this.message.from(env.get('MAIL_FROM_ADDRESS'), branding.name)

    if (branding.iconKey) {
      try {
        const stream = await drive.use().getStream(branding.iconKey)
        brandIconCid = 'dashboard-branding'
        this.message.embedData(stream, brandIconCid, {
          filename: branding.iconKey.split('/').at(-1) ?? 'dashboard-icon',
        })
      } catch (error) {
        logger.warn({ error }, 'invitation_email: failed to embed dashboard icon')
      }
    }

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
      brandName: branding.name,
      brandIconCid,
    })
  }
}
