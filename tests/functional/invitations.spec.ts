import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import Invitation from '#models/invitation'
import Role from '#models/role'
import User from '#models/user'
import AuditEvent from '#models/audit_event'
import RoleSeeder from '../../database/seeders/role_seeder.js'
import { issueInvitationToken } from '#services/invitation_token'
import { getInvitationsViewModel } from '#services/dashboard_view_models'
import {
  findUserByEmail,
  legacyEmailAddress,
  normalizeEmailAddress,
} from '#services/email_addresses'

test.group('Invitations and email identity', (group) => {
  group.each.setup(async () => {
    const rollback = await testUtils.db().withGlobalTransaction()
    await new RoleSeeder(db.connection()).run()
    return rollback
  })
  group.each.teardown(() => mail.restore())

  async function fixture() {
    const owner = await User.create({
      email: 'invite-owner@test.invalid',
      password: 'password123',
      isOwner: true,
    })
    const role = await Role.create({
      name: 'invite_member',
      displayName: 'Invite Member',
      isSystem: false,
      parentRoleId: null,
      rankPosition: 100,
    })
    const ownerRole = await Role.findByOrFail('name', 'owner')
    await owner.related('roles').attach([ownerRole.id])
    return { owner, role }
  }

  async function pendingInvite(email: string, roleId: number, ownerId: number) {
    const invitation = await Invitation.create({
      email,
      token: '',
      roleId,
      invitedBy: ownerId,
      type: 'invite',
      status: 'pending',
      deliveryStatus: 'sent',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })
    invitation.token = issueInvitationToken(invitation.id, 'invite', '7 days')
    await invitation.save()
    return invitation
  }

  test('dotted and tagged addresses are preserved through invite and acceptance', async ({
    client,
    assert,
  }) => {
    const { owner, role } = await fixture()
    mail.fake()
    const response = await client
      .post('/invitations')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ email: '  First.Last+work@Example.com  ', roleId: role.id })
    response.assertStatus(302)
    const invitation = await Invitation.query()
      .where('email', 'first.last+work@example.com')
      .firstOrFail()
    assert.equal(invitation.deliveryStatus, 'sent')
    assert.isNotNull(invitation.sentAt)
    const beforeAcceptance = await getInvitationsViewModel(owner)
    assert.isTrue(beforeAcceptance.pendingInvitations.some((item) => item.id === invitation.id))

    const accepted = await client
      .post(`/invite/${encodeURIComponent(invitation.token)}`)
      .withCsrfToken()
      .redirects(0)
      .json({
        email: 'first.last+work@example.com',
        password: 'password123',
        password_confirmation: 'password123',
        firstName: 'First',
        lastName: 'Last',
      })
    accepted.assertStatus(302)
    const user = await User.findByOrFail('email', 'first.last+work@example.com')
    const userRoles = await user.related('roles').query()
    assert.deepEqual(
      userRoles.map((item) => item.id),
      [role.id]
    )
    await invitation.refresh()
    assert.equal(invitation.status, 'accepted')
    const afterAcceptance = await getInvitationsViewModel(owner)
    assert.isFalse(afterAcceptance.pendingInvitations.some((item) => item.id === invitation.id))
  })

  test('failed delivery is recorded and can be retried', async ({ client, assert }) => {
    const { owner, role } = await fixture()
    const originalSend = mail.send
    mail.send = (async () => {
      throw new Error('test mail outage')
    }) as typeof mail.send
    try {
      await client
        .post('/invitations')
        .loginAs(owner)
        .withCsrfToken()
        .redirects(0)
        .json({ email: 'Retry.Me+tag@example.com', roleId: role.id })
      const invitation = await Invitation.query()
        .where('email', 'retry.me+tag@example.com')
        .firstOrFail()
      assert.equal(invitation.deliveryStatus, 'failed')
      assert.isNull(invitation.sentAt)
      mail.send = originalSend
      mail.fake()
      await client
        .post(`/invitations/${invitation.id}/resend`)
        .loginAs(owner)
        .withCsrfToken()
        .redirects(0)
      await invitation.refresh()
      assert.equal(invitation.deliveryStatus, 'sent')
      assert.isNotNull(invitation.sentAt)
    } finally {
      mail.send = originalSend
    }
  })

  test('existing dotted account and pending invitation reject case-varied duplicates', async ({
    client,
    assert,
  }) => {
    const { owner, role } = await fixture()
    await User.create({
      email: 'person.name+tag@example.com',
      password: 'password123',
      isOwner: false,
    })
    mail.fake()
    await client
      .post('/invitations')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ email: 'Person.Name+Tag@EXAMPLE.com', roleId: role.id })
    assert.isNull(await Invitation.findBy('email', 'person.name+tag@example.com'))

    await pendingInvite('other.name+tag@example.com', role.id, owner.id)
    await client
      .post('/invitations')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ email: 'Other.Name+Tag@EXAMPLE.com', roleId: role.id })
    const duplicateInvites = await Invitation.query().whereRaw('lower(email) = ?', [
      'other.name+tag@example.com',
    ])
    assert.lengthOf(duplicateInvites, 1)
  })

  test('locked email tampering and replay are rejected', async ({ client, assert }) => {
    const { owner, role } = await fixture()
    const invitation = await pendingInvite('person.name+tag@example.com', role.id, owner.id)
    const url = `/invite/${encodeURIComponent(invitation.token)}`
    await client.post(url).withCsrfToken().redirects(0).json({
      email: 'different@example.com',
      password: 'password123',
      password_confirmation: 'password123',
      firstName: 'Person',
      lastName: 'Name',
    })
    assert.isNull(await User.findBy('email', 'person.name+tag@example.com'))
    await invitation.refresh()
    assert.equal(invitation.status, 'pending')

    await client.post(url).withCsrfToken().redirects(0).json({
      email: 'person.name+tag@example.com',
      password: 'password123',
      password_confirmation: 'password123',
      firstName: 'Person',
      lastName: 'Name',
    })
    await client.post(url).withCsrfToken().redirects(0).json({
      email: 'person.name+tag@example.com',
      password: 'password123',
      password_confirmation: 'password123',
      firstName: 'Again',
      lastName: 'Name',
    })
    const matchingUsers = await User.query().where('email', 'person.name+tag@example.com')
    assert.lengthOf(matchingUsers, 1)
  })

  test('expired and revoked invitations cannot be accepted', async ({ client, assert }) => {
    const { owner, role } = await fixture()
    const expired = await pendingInvite('expired.name@example.com', role.id, owner.id)
    expired.expiresAt = DateTime.now().minus({ minute: 1 })
    await expired.save()
    const revoked = await pendingInvite('revoked.name@example.com', role.id, owner.id)
    revoked.status = 'revoked'
    await revoked.save()
    for (const invitation of [expired, revoked]) {
      await client
        .post(`/invite/${encodeURIComponent(invitation.token)}`)
        .withCsrfToken()
        .redirects(0)
        .json({
          email: invitation.email,
          password: 'password123',
          password_confirmation: 'password123',
          firstName: 'No',
          lastName: 'Access',
        })
      assert.isNull(await User.findBy('email', invitation.email))
    }
    const view = await getInvitationsViewModel(owner)
    assert.isTrue(view.pendingInvitations.some((item) => item.id === expired.id && item.expired))
  })

  test('legacy Gmail account is found only after an exact miss, with its stored email unchanged', async ({
    client,
    assert,
  }) => {
    const original = 'first.last+tag@gmail.com'
    const legacy = await legacyEmailAddress(original)
    assert.isNotNull(legacy)
    assert.equal(normalizeEmailAddress(' First.Last+Tag@GMAIL.com '), original)
    const account = await User.create({ email: legacy!, password: 'password123', isOwner: false })
    const response = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ email: original, password: 'password123' })
    response.assertStatus(302)
    await account.refresh()
    assert.equal(account.email, legacy)
  })

  test('exact dotted account takes precedence over a legacy alias', async ({ assert }) => {
    const dotted = 'second.person+tag@gmail.com'
    const legacy = await legacyEmailAddress(dotted)
    const oldAccount = await User.create({
      email: legacy!,
      password: 'oldPassword123',
      isOwner: false,
    })
    const exactAccount = await User.create({
      email: dotted,
      password: 'newPassword123',
      isOwner: false,
    })
    const found = await findUserByEmail(dotted)
    assert.equal(found?.id, exactAccount.id)
    assert.notEqual(oldAccount.id, exactAccount.id)
    await assert.rejects(() => User.verifyCredentials(exactAccount.email, 'oldPassword123'))
  })
})

test.group('Concurrent invitation acceptance', () => {
  test('one invitation creates exactly one account under simultaneous requests', async ({
    client,
    assert,
  }) => {
    const role = await Role.create({
      name: `parallel_role_${Date.now()}`,
      displayName: 'Parallel Role',
      isSystem: false,
      parentRoleId: null,
      rankPosition: 1000,
    })
    const email = `parallel-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`
    const invitation = await Invitation.create({
      email,
      token: '',
      roleId: role.id,
      invitedBy: null,
      type: 'invite',
      status: 'pending',
      deliveryStatus: 'unknown',
      expiresAt: DateTime.now().plus({ days: 1 }),
    })
    invitation.token = issueInvitationToken(invitation.id, 'invite', '1 day')
    await invitation.save()
    try {
      const url = `/invite/${encodeURIComponent(invitation.token)}`
      const submit = () =>
        client.post(url).withCsrfToken().redirects(0).json({
          email,
          password: 'password123',
          password_confirmation: 'password123',
          firstName: 'Parallel',
          lastName: 'Test',
        })
      await Promise.all([submit(), submit()])
      const users = await User.query().where('email', email)
      await invitation.refresh()
      assert.lengthOf(users, 1)
      assert.equal(invitation.status, 'accepted')
    } finally {
      await AuditEvent.query()
        .where('action', 'invitation.accept')
        .where('target_type', 'invitation')
        .where('target_id', invitation.id)
        .delete()
      await User.query().where('email', email).delete()
      await invitation.delete()
      await role.delete()
    }
  })
})
