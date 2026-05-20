import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Purchase from '#models/purchase'
import PurchaseItem from '#models/purchase_item'
import Machine from '#models/machine'
import Supplier from '#models/supplier'
import User from '#models/user'
import { confirmPurchase } from '#services/purchase_service'

test.group('purchase confirmation creates machines', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a machine purchase line creates qty machine rows linked back', async ({ assert }) => {
    const actor = await User.create({
      email: `pt+${Date.now()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'P',
      lastName: 'T',
    })
    const supplier = await Supplier.create({
      name: `Test Supplier ${Date.now()}`,
      isActive: true,
    })
    const purchase = await Purchase.create({
      number: `PO-${Date.now()}`,
      status: 'draft',
      supplierId: supplier.id,
      purchasedAt: DateTime.now(),
      subtotal: '0',
      taxTotal: '0',
      total: '0',
      createdByUserId: actor.id,
    } as any)
    const item = await PurchaseItem.create({
      purchaseId: purchase.id,
      itemKind: 'machine',
      itemId: 0,
      qty: '2',
      unitCost: '500',
      taxRatePct: '0',
      lineSubtotal: '1000',
      lineTax: '0',
      lineTotal: '1000',
    } as any)

    await confirmPurchase(purchase.id, actor)

    const machines = await Machine.query().where('purchase_item_id', item.id)
    assert.lengthOf(machines, 2)
    assert.equal(machines[0].status, 'idle')
  })
})
