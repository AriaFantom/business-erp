import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import Product from '#models/product'
import Component from '#models/component'
import AuditEvent from '#models/audit_event'

async function makeEditor(email: string, permission: 'products.update' | 'components.update') {
  const role = await Role.create({
    name: `t_name_edit_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    displayName: 'Catalog name editor',
    isSystem: false,
    parentRoleId: null,
  })
  await role.syncPermissions([permission])
  const actor = await User.create({ email, password: 'Passw0rd!', isOwner: false })
  await actor.related('roles').attach([role.id])
  return actor
}

test.group('Catalog name edits', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('updates a product name without changing its SKU', async ({ client, assert }) => {
    const actor = await makeEditor('product-name-editor@example.test', 'products.update')
    const product = await Product.create({
      sku: 'PRODUCT-ORIGINAL',
      name: 'Original',
      isActive: true,
    })
    const response = await client
      .post(`/catalog/products/${product.id}`)
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Renamed product', sku: 'PRODUCT-CHANGED' })

    response.assertStatus(302)
    await product.refresh()
    assert.equal(product.name, 'Renamed product')
    assert.equal(product.sku, 'PRODUCT-ORIGINAL')
    const event = await AuditEvent.query()
      .where('action', 'product.update')
      .where('target_id', product.id)
      .firstOrFail()
    assert.notProperty(event.payload, 'sku')
  })

  test('updates a component name without changing its SKU', async ({ client, assert }) => {
    const actor = await makeEditor('component-name-editor@example.test', 'components.update')
    const component = await Component.create({
      sku: 'COMPONENT-ORIGINAL',
      name: 'Original',
      unit: 'pcs',
      defaultUnitCost: '0',
      isActive: true,
    })
    const response = await client
      .post(`/catalog/components/${component.id}`)
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Renamed component', sku: 'COMPONENT-CHANGED' })

    response.assertStatus(302)
    await component.refresh()
    assert.equal(component.name, 'Renamed component')
    assert.equal(component.sku, 'COMPONENT-ORIGINAL')
    const event = await AuditEvent.query()
      .where('action', 'component.update')
      .where('target_id', component.id)
      .firstOrFail()
    assert.notProperty(event.payload, 'sku')
  })
})
