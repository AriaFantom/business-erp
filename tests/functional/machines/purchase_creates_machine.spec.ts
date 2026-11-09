import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Machine from '#models/machine'
import Supplier from '#models/supplier'
import User from '#models/user'
import { confirmPurchase, createPurchase } from '#services/purchase_service'

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
    const purchase = await createPurchase({
      supplierId: supplier.id,
      purchasedAt: DateTime.now(),
      shippingCharge: 20,
      taxAmount: 10,
      items: [
        {
          itemKind: 'machine',
          machineName: `Press ${Date.now()}`,
          machineModel: 'P-200',
          qty: 2,
          unitCost: 500,
        },
      ],
      actor,
    })

    await confirmPurchase(purchase.id, actor)

    const machines = await Machine.query()
      .whereNotNull('purchase_item_id')
      .orderBy('id', 'desc')
      .limit(2)
    assert.lengthOf(machines, 2)
    assert.equal(machines[0].status, 'idle')
    assert.equal(machines[0].model, 'P-200')
    const item = await machines[0].related('purchaseItem').query().firstOrFail()
    assert.equal(Number(item.landedUnitCost), 515)
    await assert.rejects(() => confirmPurchase(purchase.id, actor))
    assert.lengthOf(await Machine.query().where('purchase_item_id', item.id), 2)
  })
})
