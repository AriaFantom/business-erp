import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import AppSetting from '#models/app_setting'
import AuditEvent from '#models/audit_event'
import User from '#models/user'
import drive from '@adonisjs/drive/services/main'

test.group('Dashboard branding', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('owner can rename the dashboard and the setting is audited', async ({ client, assert }) => {
    const owner = await User.create({
      email: 'branding-owner@example.test',
      password: 'password123',
      isOwner: true,
    })
    const response = await client
      .post('/system/branding')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Workshop Control' })
    response.assertStatus(302)
    const row = await AppSetting.findByOrFail('key', 'dashboard_branding')
    assert.equal(row.value.name, 'Workshop Control')
    assert.isNotNull(await AuditEvent.query().where('action', 'settings.branding.rename').first())
  })

  test('non-owner cannot change branding', async ({ client, assert }) => {
    const user = await User.create({
      email: 'branding-user@example.test',
      password: 'password123',
      isOwner: false,
    })
    const update = await client
      .post('/system/branding')
      .loginAs(user)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Unapproved' })
    update.assertStatus(302)
    assert.isNull(await AppSetting.findBy('key', 'dashboard_branding'))
  })

  test('owner can upload, stream, and remove the private dashboard icon', async ({
    client,
    assert,
  }) => {
    const owner = await User.create({
      email: 'branding-icon-owner@example.test',
      password: 'password123',
      isOwner: true,
    })
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9f4C0AAAAASUVORK5CYII=',
      'base64'
    )
    const upload = await client
      .post('/system/branding/icon')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .file('icon', png, { filename: 'logo.png', contentType: 'image/png' })
    upload.assertStatus(302)
    const row = await AppSetting.findByOrFail('key', 'dashboard_branding')
    assert.isTrue(await drive.use().exists(row.value.iconKey))
    const image = await client.get('/branding/icon').loginAs(owner)
    image.assertStatus(200)

    const remove = await client
      .post('/system/branding/icon/delete')
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
    remove.assertStatus(302)
    await row.refresh()
    assert.isNull(row.value.iconKey)
  })
})
