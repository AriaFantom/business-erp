import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Material from '#models/material'
import Component from '#models/component'
import Supplier from '#models/supplier'
import { getComponentsViewModel, getMaterialsViewModel } from '#services/catalog_view_models'

let sequence = 0
const unique = (prefix: string) => `${prefix}-${Date.now()}-${++sequence}`

test.group('Catalog Quick add defaults', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('uses the newest active item independently of filters and ignores inactive suppliers', async ({
    assert,
  }) => {
    const activeSupplier = await Supplier.create({ name: unique('Supplier'), isActive: true })
    const inactiveSupplier = await Supplier.create({ name: unique('Supplier'), isActive: false })
    await Material.create({
      sku: unique('MAT'),
      name: 'Older material',
      type: 'filament',
      unit: 'g',
      defaultSupplierId: activeSupplier.id,
      defaultUnitCost: '2.5',
      reorderThresholdG: '4',
      isActive: true,
    })
    await Material.create({
      sku: unique('MAT'),
      name: 'Newest material',
      type: 'resin',
      unit: 'ml',
      defaultSupplierId: inactiveSupplier.id,
      defaultUnitCost: '8.75',
      reorderThresholdG: '12.5',
      isActive: true,
    })
    await Component.create({
      sku: unique('CMP'),
      name: 'Newest component',
      unit: 'pcs',
      defaultSupplierId: activeSupplier.id,
      defaultUnitCost: '1.25',
      reorderThresholdQty: 6,
      isActive: true,
    })

    const materialView = await getMaterialsViewModel({ q: 'does-not-match' })
    const componentView = await getComponentsViewModel({ status: 'archived' })

    assert.equal(materialView.materials.length, 0)
    assert.equal(materialView.quickAddDefaults?.sourceName, 'Newest material')
    assert.equal(materialView.quickAddDefaults?.unit, 'ml')
    assert.isNull(materialView.quickAddDefaults?.defaultSupplierId)
    assert.equal(componentView.quickAddDefaults?.sourceName, 'Newest component')
    assert.equal(componentView.quickAddDefaults?.defaultSupplierId, activeSupplier.id)
    assert.equal(componentView.quickAddDefaults?.reorderThresholdQty, 6)
  })
})
