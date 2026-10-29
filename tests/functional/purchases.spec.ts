import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import User from '#models/user'
import Supplier from '#models/supplier'
import Material from '#models/material'
import PurchaseItem from '#models/purchase_item'
import Inventory from '#models/inventory'
import StockMovement from '#models/stock_movement'
import PurchaseReturn from '#models/purchase_return'
import PurchasePayment from '#models/purchase_payment'
import AppSetting from '#models/app_setting'
import {
  allocatePurchaseCharge,
  confirmPurchase,
  createPurchase,
  recordPurchasePayment,
  returnPurchaseItems,
} from '#services/purchase_service'
import { invalidateEnabledModulesCache } from '#services/modules/module_service'

let sequence = 0

function unique(prefix: string) {
  sequence += 1
  return `${prefix}-${Date.now()}-${sequence}`
}

async function fixtures() {
  const actor = await User.create({
    email: `${unique('purchase')}@example.com`,
    password: 'Passw0rd!',
    firstName: 'Purchase',
    lastName: 'Tester',
    isOwner: true,
  })
  const supplier = await Supplier.create({
    name: unique('Supplier'),
    isActive: true,
  })
  const first = await Material.create({
    sku: unique('MAT'),
    name: 'First material',
    unit: 'kg',
    type: 'raw',
    defaultUnitCost: '0',
    isActive: true,
  })
  const second = await Material.create({
    sku: unique('MAT'),
    name: 'Second material',
    unit: 'kg',
    type: 'raw',
    defaultUnitCost: '0',
    isActive: true,
  })

  await AppSetting.query().where('key', 'enabled_modules').delete()
  await invalidateEnabledModulesCache()

  return { actor, supplier, first, second }
}

test.group('Purchase shipping and invoice tax', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('allocates fixed charges exactly and persists four-decimal landed costs', async ({
    assert,
  }) => {
    const { actor, supplier, first, second } = await fixtures()
    const purchase = await createPurchase({
      supplierId: supplier.id,
      purchasedAt: DateTime.now(),
      shippingCharge: 10.01,
      taxAmount: 3.01,
      items: [
        { itemKind: 'material', itemId: first.id, qty: 3, unitCost: 11.11 },
        { itemKind: 'material', itemId: second.id, qty: 2, unitCost: 33.335 },
      ],
      actor,
    })

    assert.equal(purchase.subtotal, '100')
    assert.equal(purchase.shippingCharge, '10.01')
    assert.equal(purchase.taxTotal, '3.01')
    assert.equal(purchase.total, '113.02')
    assert.equal(purchase.taxEntryMode, 'invoice_amount')

    const lines = await PurchaseItem.query().where('purchase_id', purchase.id).orderBy('id')
    assert.deepEqual(
      lines.map((line) => Number(line.allocatedShipping)),
      [3.34, 6.67]
    )
    assert.deepEqual(
      lines.map((line) => Number(line.allocatedTax)),
      [1, 2.01]
    )
    assert.deepEqual(
      lines.map((line) => Number(line.landedUnitCost)),
      [12.5567, 37.675]
    )
    assert.equal(
      lines.reduce((sum, line) => sum + Number(line.allocatedShipping), 0),
      10.01
    )
    assert.equal(
      lines.reduce((sum, line) => sum + Number(line.allocatedTax), 0),
      3.01
    )
  })

  test('uses deterministic line order when allocation remainders tie', ({ assert }) => {
    assert.deepEqual(allocatePurchaseCharge(0.01, [1, 1, 1]), [0.01, 0, 0])
    assert.deepEqual(allocatePurchaseCharge(0.02, [1, 1, 1]), [0.01, 0.01, 0])
  })

  test('handles zero, shipping-only and tax-only purchase charges', async ({ assert }) => {
    const { actor, supplier, first } = await fixtures()
    const scenarios = [
      { shippingCharge: 0, taxAmount: 0, total: 20, landed: 10 },
      { shippingCharge: 2.5, taxAmount: 0, total: 22.5, landed: 11.25 },
      { shippingCharge: 0, taxAmount: 1.5, total: 21.5, landed: 10.75 },
    ]

    for (const scenario of scenarios) {
      const purchase = await createPurchase({
        supplierId: supplier.id,
        purchasedAt: DateTime.now(),
        shippingCharge: scenario.shippingCharge,
        taxAmount: scenario.taxAmount,
        items: [{ itemKind: 'material', itemId: first.id, qty: 2, unitCost: 10 }],
        actor,
      })
      const line = await PurchaseItem.query().where('purchase_id', purchase.id).firstOrFail()
      assert.equal(Number(purchase.total), scenario.total)
      assert.equal(Number(line.landedUnitCost), scenario.landed)
    }
  })

  test('confirms at landed cost while returns credit goods value only', async ({ assert }) => {
    const { actor, supplier, first } = await fixtures()
    const purchase = await createPurchase({
      supplierId: supplier.id,
      purchasedAt: DateTime.now(),
      shippingCharge: 6,
      taxAmount: 3,
      items: [{ itemKind: 'material', itemId: first.id, qty: 3, unitCost: 10 }],
      actor,
    })

    await confirmPurchase(purchase.id, actor)

    const inventory = await Inventory.query()
      .where('item_kind', 'material')
      .where('item_id', first.id)
      .firstOrFail()
    const movement = await StockMovement.query()
      .where('reference_type', 'purchase')
      .where('reference_id', purchase.id)
      .firstOrFail()
    assert.equal(Number(inventory.avgUnitCost), 13)
    assert.equal(Number(movement.unitCost), 13)

    const line = await PurchaseItem.query().where('purchase_id', purchase.id).firstOrFail()
    const returned = await returnPurchaseItems({
      purchaseId: purchase.id,
      items: [{ purchaseItemId: line.id, qty: 1 }],
      actor,
    })
    assert.equal(Number(returned.total), 10)
    const persistedReturn = await PurchaseReturn.findOrFail(returned.id)
    assert.equal(Number(persistedReturn.total), 10)

    const finalReturn = await returnPurchaseItems({
      purchaseId: purchase.id,
      items: [{ purchaseItemId: line.id, qty: 2 }],
      actor,
    })
    assert.equal(Number(finalReturn.total), 20)
    await assert.rejects(() => confirmPurchase(purchase.id, actor))
    await inventory.refresh()
    assert.equal(Number(inventory.qty), 0)
  })

  test('keeps legacy line tax behavior when invoice tax is omitted', async ({ assert }) => {
    const { actor, supplier, first } = await fixtures()
    const purchase = await createPurchase({
      supplierId: supplier.id,
      purchasedAt: DateTime.now(),
      shippingCharge: 10,
      items: [
        {
          itemKind: 'material',
          itemId: first.id,
          qty: 1,
          unitCost: 100,
          taxRatePct: 18,
        },
      ],
      actor,
    })

    assert.equal(purchase.taxEntryMode, 'legacy_line')
    assert.equal(Number(purchase.taxTotal), 18)
    assert.equal(Number(purchase.total), 128)
    const line = await PurchaseItem.query().where('purchase_id', purchase.id).firstOrFail()
    assert.equal(Number(line.lineTax), 18)
    assert.equal(Number(line.allocatedTax), 0)
    assert.equal(Number(line.landedUnitCost), 110)
  })

  test('includes purchase charges in the payable and payment limit', async ({ assert }) => {
    const { actor, supplier, first } = await fixtures()
    const purchase = await createPurchase({
      supplierId: supplier.id,
      purchasedAt: DateTime.now(),
      shippingCharge: 5,
      taxAmount: 7,
      items: [{ itemKind: 'material', itemId: first.id, qty: 1, unitCost: 100 }],
      actor,
    })
    await confirmPurchase(purchase.id, actor)
    await recordPurchasePayment({
      purchaseId: purchase.id,
      amount: 112,
      method: 'bank',
      actor,
    })

    const payment = await PurchasePayment.query().where('purchase_id', purchase.id).firstOrFail()
    assert.equal(Number(payment.amount), 112)
    await assert.rejects(
      () =>
        recordPurchasePayment({
          purchaseId: purchase.id,
          amount: 0.01,
          method: 'cash',
          actor,
        }),
      /remaining balance/
    )
  })

  test('rejects conflicting, unallocatable, malformed and overflowing charges', async ({
    assert,
  }) => {
    const { actor, supplier, first } = await fixtures()
    const base = {
      supplierId: supplier.id,
      purchasedAt: DateTime.now(),
      actor,
    }

    await assert.rejects(
      () =>
        createPurchase({
          ...base,
          taxAmount: 1,
          items: [
            {
              itemKind: 'material',
              itemId: first.id,
              qty: 1,
              unitCost: 10,
              taxRatePct: 5,
            },
          ],
        }),
      /cannot be combined/
    )
    await assert.rejects(
      () =>
        createPurchase({
          ...base,
          shippingCharge: 1,
          items: [{ itemKind: 'material', itemId: first.id, qty: 1, unitCost: 0 }],
        }),
      /subtotal is zero/
    )

    for (const taxAmount of [-1, 1.001, Number.POSITIVE_INFINITY, 'bad' as unknown as number]) {
      await assert.rejects(
        () =>
          createPurchase({
            ...base,
            taxAmount,
            items: [{ itemKind: 'material', itemId: first.id, qty: 1, unitCost: 10 }],
          }),
        /non-negative amount/
      )
    }

    await assert.rejects(
      () =>
        createPurchase({
          ...base,
          items: [
            {
              itemKind: 'material',
              itemId: first.id,
              qty: 100_000,
              unitCost: 10_000_000,
            },
          ],
        }),
      /too large to save safely/
    )
  })
})
