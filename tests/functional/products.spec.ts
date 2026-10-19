import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import User from '#models/user'
import Role from '#models/role'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
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

async function makeUserWithProductsCreate(email: string): Promise<User> {
  const role = await Role.create({
    name: `t_prod_create_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    displayName: 'Test Products Create',
    isSystem: false,
    parentRoleId: null,
  })
  await role.syncPermissions(['products.create'])

  const user = await User.create({
    email,
    password: 'Passw0rd!',
    firstName: 'T',
    lastName: 'C',
    isOwner: false,
  })
  await user.related('roles').attach([role.id])
  return user
}

// ── tests ──────────────────────────────────────────────────────────────────

test.group('Product creation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('inherits category defaults and stores a picture during creation', async ({
    client,
    assert,
  }) => {
    const actor = await makeUserWithProductsCreate(`create+${Date.now()}@test.com`)
    const category = await ProductCategory.create({
      name: `Test Category ${Date.now()}`,
      defaultProfitPct: '27.5',
      taxRatePct: '18',
      isActive: true,
    })
    const sku = `CREATE-${Date.now()}`
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9f4C0AAAAASUVORK5CYII=',
      'base64'
    )

    const response = await client
      .post('/catalog/products')
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .field('sku', sku)
      .field('name', 'Quick Product')
      .field('categoryId', String(category.id))
      .file('image', png, { filename: 'picture.png', contentType: 'image/png' })

    response.assertStatus(302)
    const product = await Product.findByOrFail('sku', sku)
    assert.equal(product.categoryId, category.id)
    assert.equal(Number(product.defaultProfitPct), 27.5)
    assert.equal(Number(product.taxRatePct), 18)
    assert.isNotNull(product.imageKey)
    assert.isTrue(await drive.use().exists(product.imageKey!))

    const event = await AuditEvent.query()
      .where('action', 'product.create')
      .where('target_id', product.id)
      .firstOrFail()
    assert.equal(event.payload?.image, '<file>')
  })

  test('explicit percentages override category defaults', async ({ client, assert }) => {
    const actor = await makeUserWithProductsCreate(`override+${Date.now()}@test.com`)
    const category = await ProductCategory.create({
      name: `Override Category ${Date.now()}`,
      defaultProfitPct: '30',
      taxRatePct: '18',
      isActive: true,
    })
    const sku = `OVERRIDE-${Date.now()}`

    const response = await client
      .post('/catalog/products')
      .loginAs(actor)
      .withCsrfToken()
      .redirects(0)
      .json({
        sku,
        name: 'Configured Product',
        categoryId: category.id,
        defaultProfitPct: 0,
        taxRatePct: 5,
      })

    response.assertStatus(302)
    const product = await Product.findByOrFail('sku', sku)
    assert.equal(Number(product.defaultProfitPct), 0)
    assert.equal(Number(product.taxRatePct), 5)
    assert.isNull(product.imageKey)
  })
})

test.group('Product default-price endpoints', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  // 1. Unauthenticated set is rejected
  test('unauthenticated POST to set-default-price redirects to login', async ({
    client,
    assert,
  }) => {
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
