import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Role from '#models/role'
import User from '#models/user'

test.group('Combined users and invitations page', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function userWithPermissions(email: string, permissions: string[]) {
    const role = await Role.create({
      name: `role_${email.split('@')[0]}`,
      displayName: 'Scoped role',
      rankPosition: 500,
      isSystem: false,
    })
    await role.syncPermissions(permissions)
    const user = await User.create({ email, password: 'password123', isOwner: false })
    await user.related('roles').attach([role.id])
    return user
  }

  test('users-only permission receives no invitation data', async ({ client, assert }) => {
    const user = await userWithPermissions('users-only@example.test', ['users.view'])
    const response = await client
      .get('/system/users?tab=invitations')
      .header('X-Inertia', 'true')
      .header('X-Inertia-Version', '1')
      .loginAs(user)
    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.component, 'system/users')
    assert.isTrue(body.props.canViewUsers)
    assert.isFalse(body.props.canViewInvitations)
    assert.notProperty(body.props, 'pendingInvitations')
  })

  test('invite-only permission receives no user-list data', async ({ client, assert }) => {
    const user = await userWithPermissions('invite-only@example.test', ['users.invite'])
    const response = await client
      .get('/system/users')
      .header('X-Inertia', 'true')
      .header('X-Inertia-Version', '1')
      .loginAs(user)
    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.component, 'system/users')
    assert.isFalse(body.props.canViewUsers)
    assert.isTrue(body.props.canViewInvitations)
    assert.notProperty(body.props, 'users')
    assert.equal(body.props.initialTab, 'invitations')
  })

  test('legacy invitations URL redirects to the invitations tab', async ({ client }) => {
    const user = await userWithPermissions('invite-redirect@example.test', ['users.invite'])
    const response = await client.get('/system/invitations').loginAs(user).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/system/users?tab=invitations')
  })
})
