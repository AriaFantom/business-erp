import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Customer from '#models/customer'
import AuditEvent from '#models/audit_event'

let sequence = 0

test.group('Customer editing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('updates all editable details without changing status or history', async ({
    client,
    assert,
  }) => {
    sequence += 1
    const owner = await User.create({
      email: `customer-edit-${Date.now()}-${sequence}@example.com`,
      password: 'Passw0rd!',
      firstName: 'Customer',
      lastName: 'Editor',
      isOwner: true,
    })
    const customer = await Customer.create({
      name: 'Old name',
      gstin: 'OLDGST',
      email: 'old@example.com',
      phone: '111',
      billingAddress: 'Old billing',
      shippingAddress: 'Old shipping',
      creditLimit: '500',
      isActive: true,
    })

    const response = await client
      .post(`/customers/${customer.id}`)
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)
      .json({
        name: 'New name',
        gstin: null,
        email: null,
        phone: '222',
        billingAddress: null,
        shippingAddress: 'New shipping',
        creditLimit: null,
        isActive: false,
      })

    response.assertStatus(302)
    await customer.refresh()
    assert.equal(customer.name, 'New name')
    assert.isNull(customer.gstin)
    assert.isNull(customer.email)
    assert.equal(customer.phone, '222')
    assert.isNull(customer.billingAddress)
    assert.equal(customer.shippingAddress, 'New shipping')
    assert.isNull(customer.creditLimit)
    assert.isTrue(customer.isActive)
    assert.exists(
      await AuditEvent.query()
        .where('action', 'customer.update')
        .where('target_id', customer.id)
        .first()
    )
  })
})
