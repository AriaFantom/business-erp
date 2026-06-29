import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import AppSetting from '#models/app_setting'
import {
  ENABLED_MODULES_KEY,
  getEnabledModules,
  invalidateEnabledModulesCache,
  setEnabledModules,
} from '#services/modules/module_service'

async function makeUserWithPerms(email: string, perms: string[]): Promise<User> {
  const role = await Role.create({
    name: `t_set_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
    displayName: 'Test Settings Role',
    isSystem: false,
    parentRoleId: null,
  })
  await role.syncPermissions(perms)
  const user = await User.create({
    email,
    password: 'Passw0rd!',
    firstName: 'T',
    lastName: 'U',
    isOwner: false,
  })
  await user.related('roles').attach([role.id])
  return user
}

/** Full permissions for managing modules. */
const makeManager = (email: string) =>
  makeUserWithPerms(email, ['settings.view', 'settings.manageModules'])

test.group('Module settings', (group) => {
  group.each.setup(async () => {
    await invalidateEnabledModulesCache()
    return testUtils.db().withGlobalTransaction()
  })
  // The enabled-module set is cached; clear it so a test's (rolled-back) change
  // never leaks into the next test.
  group.each.teardown(() => invalidateEnabledModulesCache())

  test('a user with settings.view can open the modules page', async ({ client }) => {
    const manager = await makeManager(`view+${Date.now()}@test.com`)
    const res = await client.get('/system/modules').loginAs(manager)
    res.assertStatus(200)
  })

  test('a user without settings.manageModules cannot change modules', async ({
    client,
    assert,
  }) => {
    const member = await makeUserWithPerms(`member+${Date.now()}@test.com`, ['inventory.view'])
    await client
      .post('/system/modules')
      .loginAs(member)
      .withCsrfToken()
      .redirects(0)
      .json({ enabledModules: ['inventory'] })

    // The security guarantee: the stored configuration is untouched.
    await invalidateEnabledModulesCache()
    const after = await getEnabledModules()
    assert.includeMembers(after, ['purchase', 'sales'])
  })

  test('disabling a module blocks its routes (GET redirects, POST 404s)', async ({
    client,
    assert,
  }) => {
    const owner = await User.create({
      email: `gate+${Date.now()}@test.com`,
      password: 'Passw0rd!',
      firstName: 'O',
      lastName: 'W',
      isOwner: true,
    })
    // Everything except purchase.
    await setEnabledModules(
      [
        'inventory',
        'manufacturing',
        'machines',
        'sales',
        'invoices',
        'quotations',
        'pos',
        'reports',
      ],
      owner
    )

    const getRes = await client.get('/purchases').loginAs(owner).redirects(0)
    getRes.assertStatus(302)
    assert.equal(getRes.header('location'), '/dashboard')

    const postRes = await client
      .post('/purchases')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({})
    postRes.assertStatus(404)
  })

  test('an invalid selection is rejected and does not persist', async ({ client, assert }) => {
    const manager = await makeManager(`invalid+${Date.now()}@test.com`)
    const before = await getEnabledModules()

    // sales requires inventory + invoices — omitting them must be refused.
    const res = await client
      .post('/system/modules')
      .loginAs(manager)
      .withCsrfToken()
      .redirects(0)
      .json({ enabledModules: ['sales'] })
    res.assertStatus(302) // redirected back with a flash error

    await invalidateEnabledModulesCache()
    const after = await getEnabledModules()
    assert.deepEqual(after, before, 'invalid selection must not change stored modules')
  })

  test('a valid update persists and writes the setting row', async ({ client, assert }) => {
    const manager = await makeManager(`valid+${Date.now()}@test.com`)
    const res = await client
      .post('/system/modules')
      .loginAs(manager)
      .withCsrfToken()
      .redirects(0)
      .json({ enabledModules: ['inventory', 'sales', 'invoices', 'pos', 'reports'] })
    res.assertStatus(302)

    const row = await AppSetting.findBy('key', ENABLED_MODULES_KEY)
    assert.isNotNull(row)
    assert.notInclude(row!.value as string[], 'purchase')
    assert.includeMembers(row!.value as string[], ['inventory', 'sales', 'invoices'])
  })
})
