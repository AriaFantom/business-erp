import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Customer from '#models/customer'
import Material from '#models/material'
import Component from '#models/component'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import QuotationItem from '#models/quotation_item'
import QuotationItemBom from '#models/quotation_item_bom'
import Inventory from '#models/inventory'
import { createQuotation } from '#services/quotation_service'
import { estimateQuotationLine } from '#services/quotation_estimate_service'

let sequence = 0
const unique = (prefix: string) => `${prefix}-${Date.now()}-${++sequence}`

test.group('Quotation cost estimates', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('uses category markup, rounds upward, and persists a cost snapshot without stock changes', async ({
    assert,
  }) => {
    const actor = await User.create({
      email: `${unique('estimate')}@example.com`,
      password: 'Passw0rd!',
      firstName: 'Estimate',
      lastName: 'Tester',
      isOwner: true,
    })
    const customer = await Customer.create({ name: unique('Customer'), isActive: true })
    const category = await ProductCategory.create({
      name: unique('Category'),
      defaultProfitPct: '25',
      taxRatePct: '18',
      isActive: true,
    })
    const product = await Product.create({
      sku: unique('PROD'),
      name: 'Unmade product',
      categoryId: category.id,
      defaultProfitPct: '90',
      isActive: true,
    })
    const material = await Material.create({
      sku: unique('MAT'),
      name: 'Estimate material',
      type: 'other',
      unit: 'kg',
      defaultUnitCost: '3.3333',
      isActive: true,
    })
    const component = await Component.create({
      sku: unique('CMP'),
      name: 'Estimate component',
      unit: 'pcs',
      defaultUnitCost: '0',
      isActive: true,
    })
    const boms = [
      { itemKind: 'material' as const, itemId: material.id, qty: 1_000, unit: 'g' },
      { itemKind: 'material' as const, itemId: material.id, qty: 1, unit: 'kg' },
      { itemKind: 'component' as const, itemId: component.id, qty: 1 },
    ]

    const estimate = await estimateQuotationLine({
      productId: product.id,
      extraCost: 1,
      boms,
    })

    assert.equal(estimate.profitPct, 25)
    assert.equal(estimate.profitFrom, 'category')
    assert.equal(estimate.estimatedUnitCost, 7.6666)
    assert.equal(estimate.suggestedUnitPrice, 9.59)
    assert.equal(estimate.boms.find((bom) => bom.itemId === material.id)?.qty, 2)
    assert.equal(estimate.boms.find((bom) => bom.itemId === material.id)?.unit, 'kg')
    assert.isTrue(estimate.boms.find((bom) => bom.itemId === component.id)?.zeroCost)

    const stockBefore = await Inventory.query().count('* as total').first()
    const quotation = await createQuotation({
      customerId: customer.id,
      validUntil: customer.createdAt.plus({ days: 14 }),
      actor,
      items: [
        {
          productId: product.id,
          name: product.name,
          qty: 3,
          taxRatePct: 18,
          boms,
          pricingMode: 'estimated',
          estimate: {
            extraCost: 1,
            profitPct: estimate.profitPct,
            expectedFingerprint: estimate.fingerprint,
          },
        },
      ],
    })
    const item = await QuotationItem.query().where('quotation_id', quotation.id).firstOrFail()
    const materialBom = await QuotationItemBom.query()
      .where('quotation_item_id', item.id)
      .where('item_kind', 'material')
      .firstOrFail()
    const stockAfter = await Inventory.query().count('* as total').first()

    assert.equal(item.pricingBasis, 'estimated')
    assert.equal(item.estimatedUnitCost, '7.6666')
    assert.equal(item.estimatedSuggestedUnitPrice, '9.59')
    assert.equal(Number(item.unitPrice), 9.59)
    assert.equal(Number(materialBom.qty), 2)
    assert.equal(stockAfter?.$extras.total ?? 0, stockBefore?.$extras.total ?? 0)
  })

  test('requires review when catalog costs change after preview', async ({ assert }) => {
    const actor = await User.create({
      email: `${unique('stale')}@example.com`,
      password: 'Passw0rd!',
      firstName: 'Estimate',
      lastName: 'Tester',
      isOwner: true,
    })
    const customer = await Customer.create({ name: unique('Customer'), isActive: true })
    const material = await Material.create({
      sku: unique('MAT'),
      name: 'Changing material',
      type: 'other',
      unit: 'g',
      defaultUnitCost: '2',
      isActive: true,
    })
    const boms = [{ itemKind: 'material' as const, itemId: material.id, qty: 1 }]
    const preview = await estimateQuotationLine({ extraCost: 0, boms })
    material.defaultUnitCost = '3'
    await material.save()

    await assert.rejects(
      () =>
        createQuotation({
          customerId: customer.id,
          validUntil: customer.createdAt.plus({ days: 14 }),
          actor,
          items: [
            {
              name: 'Custom estimate',
              qty: 1,
              boms,
              pricingMode: 'estimated',
              estimate: {
                extraCost: 0,
                profitPct: preview.profitPct,
                expectedFingerprint: preview.fingerprint,
              },
            },
          ],
        }),
      /Catalog costs changed/
    )
  })
})
