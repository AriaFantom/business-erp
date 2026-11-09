import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Material from '#models/material'
import Purchase from '#models/purchase'
import PurchaseItem from '#models/purchase_item'
import Supplier from '#models/supplier'
import User from '#models/user'
import { deleteUnusedCatalogItem } from '#services/catalog_deletion_service'
import db from '@adonisjs/lucid/services/db'

test.group('safe catalog deletion', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('deletes unused materials but preserves purchase history', async ({ assert }) => {
    const actor = await User.create({
      email: `delete+${Date.now()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'Delete',
      lastName: 'Tester',
    })
    const unused = await Material.create({
      sku: `UNUSED-${Date.now()}`,
      name: 'Unused material',
      type: 'other',
      unit: 'g',
      isActive: true,
    })
    await deleteUnusedCatalogItem('material', unused.id, actor)
    assert.isNull(await Material.find(unused.id))

    const supplier = await Supplier.create({
      name: `Delete supplier ${Date.now()}`,
      isActive: true,
    })
    const used = await Material.create({
      sku: `USED-${Date.now()}`,
      name: 'Used material',
      type: 'other',
      unit: 'g',
      isActive: true,
    })
    const purchase = await Purchase.create({
      number: `PO-DELETE-${Date.now()}`,
      supplierId: supplier.id,
      status: 'draft',
      purchasedAt: DateTime.now(),
      subtotal: '1',
      taxTotal: '0',
      total: '1',
      createdByUserId: actor.id,
    } as Partial<Purchase>)
    await PurchaseItem.create({
      purchaseId: purchase.id,
      itemKind: 'material',
      itemId: used.id,
      qty: '1',
      unitCost: '1',
      taxRatePct: '0',
      lineSubtotal: '1',
      lineTax: '0',
      lineTotal: '1',
    } as Partial<PurchaseItem>)

    await assert.rejects(
      () => deleteUnusedCatalogItem('material', used.id, actor),
      /Purchase history exists/
    )
    await assert.rejects(() =>
      db.transaction((trx) => trx.from('materials').where('id', used.id).delete())
    )
    assert.isNotNull(await Material.find(used.id))
  })

  test('lets the workspace owner delete an unused material without seeded role permissions', async ({
    client,
    assert,
  }) => {
    const owner = await User.create({
      email: `delete-owner+${Date.now()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'Delete',
      lastName: 'Owner',
      isOwner: true,
    })
    const material = await Material.create({
      sku: `OWNER-DELETE-${Date.now()}`,
      name: 'Owner deletable material',
      type: 'other',
      unit: 'g',
      isActive: true,
    })

    const response = await client
      .post(`/catalog/materials/${material.id}/delete`)
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.isNull(await Material.find(material.id))
  })
})
