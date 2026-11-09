import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import AuditEvent from '#models/audit_event'
import Supplier from '#models/supplier'
import User from '#models/user'

test.group('Suppliers', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('owner can update every supplier detail', async ({ client, assert }) => {
    const owner = await User.create({
      email: `supplier-owner+${Date.now()}@example.test`,
      password: 'Passw0rd!',
      isOwner: true,
    })
    const supplier = await Supplier.create({
      name: 'Old supplier',
      gstin: 'OLD-GSTIN',
      email: 'old@example.test',
      phone: '1111111111',
      address: 'Old address',
      isActive: true,
    })

    const response = await client
      .post(`/suppliers/${supplier.id}`)
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({
        name: 'Updated supplier',
        gstin: 'NEW-GSTIN',
        email: 'updated@example.test',
        phone: '9999999999',
        address: '42 Updated Street',
      })

    response.assertStatus(302)
    await supplier.refresh()
    assert.equal(supplier.name, 'Updated supplier')
    assert.equal(supplier.gstin, 'NEW-GSTIN')
    assert.equal(supplier.email, 'updated@example.test')
    assert.equal(supplier.phone, '9999999999')
    assert.equal(supplier.address, '42 Updated Street')

    const event = await AuditEvent.query()
      .where('action', 'supplier.update')
      .where('target_id', supplier.id)
      .firstOrFail()
    assert.equal(event.payload?.name, 'Updated supplier')
  })
})
