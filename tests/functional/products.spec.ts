import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import Product from '#models/product'
import AuditEvent from '#models/audit_event'

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Create a user that holds the `products.update` permission via a role.
 * Each caller gets a dedicated role so tests don't share mutable state.
 */
async function makeUserWithProductsUpdate(email: string): Promise<User> {
  const role = await Role.create({
    name: `t_prod_update_${Date.now()}`,
    displayName: 'Test Products Update',
    isSystem: false,
    parentRoleId: null,
  })
  await role.syncPermissions(['products.update'])

  const user = await User.create({
    email,
    password: 'Passw0rd!',
    firstName: 'T',
    lastName: 'U',
    isOwner: false,
  })
  await user.related('roles').attach([role.id])
  return user
}

async function makeProduct(overrides: Partial<{ sku: string; name: string }> = {}) {
  return Product.create({
    sku: overrides.sku ?? `SKU-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    name: overrides.name ?? 'Test Product',
    isActive: true,
  } as any)
}

// ── tests ──────────────────────────────────────────────────────────────────

test.group('Product default-price endpoints', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  // 1. Unauthenticated set is rejected
  test('unauthenticated POST to set-default-price redirects to login', async ({ client, assert }) => {
    const product = await makeProduct()

    // Include a CSRF token so the shield middleware passes, leaving the auth
    // middleware to handle the unauthenticated request (→ redirect to /login).
    const response = await client
      .post(`/catalog/products/${product.id}/default-price`)
      .withCsrfToken()
      .redirects(0)
      .json({ price: 500, sourceJobId: null })

    // Auth middleware redirects unauthenticated requests to /login
    response.assertStatus(302)
    assert.equal(response.header('location'), '/login')
  })

  // 2. Authenticated set creates row + audit
  test('authenticated set updates product and writes audit row', async ({ client, assert }) => {
    const actor = await makeUserWithProductsUpdate(`set+${Date.now()}@test.com`)
    const product = await makeProduct()

    const response = await client
      .post(`/catalog/products/${product.id}/default-price`)
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({ price: 1499, sourceJobId: null })

    // Inertia POST redirects back on success (302)
    response.assertStatus(302)

    await product.refresh()
    assert.equal(product.defaultSalePrice, '1499.00')
    assert.equal(product.defaultSalePriceSetByUserId, actor.id)

    const audit = await AuditEvent.query()
      .where('action', 'product.default_price.set')
      .where('target_type', 'product')
      .where('target_id', product.id)
      .first()
    assert.isNotNull(audit, 'expected an audit row for product.default_price.set')
  })

  // 3. Clear default removes price + audits
  test('clear endpoint nulls the pinned price and writes audit row', async ({ client, assert }) => {
    const actor = await makeUserWithProductsUpdate(`clr+${Date.now()}@test.com`)
    const product = await makeProduct()

    // Seed a pinned price directly in the DB
    product.merge({
      defaultSalePrice: '999',
      defaultSalePriceSetByUserId: actor.id,
    })
    await product.save()

    const response = await client
      .post(`/catalog/products/${product.id}/default-price/delete`)
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    await product.refresh()
    assert.isNull(product.defaultSalePrice)

    const audit = await AuditEvent.query()
      .where('action', 'product.default_price.clear')
      .where('target_type', 'product')
      .where('target_id', product.id)
      .first()
    assert.isNotNull(audit, 'expected an audit row for product.default_price.clear')
  })

  // 4. Validation rejects non-positive price
  test('posting a non-positive price redirects back with validation errors', async ({
    client,
    assert,
  }) => {
    const actor = await makeUserWithProductsUpdate(`val+${Date.now()}@test.com`)
    const product = await makeProduct()

    const response = await client
      .post(`/catalog/products/${product.id}/default-price`)
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({ price: -10 })

    // VineJS validation failures on Inertia POST → redirect back (302)
    // with errors stored under the session flash key "inputErrorsBag"
    response.assertStatus(302)
    const inputErrors = response.flashMessage('inputErrorsBag') as Record<string, string> | null
    assert.property(inputErrors ?? {}, 'price')
  })
})
