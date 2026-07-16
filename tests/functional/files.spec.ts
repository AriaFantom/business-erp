import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import Product from '#models/product'
import Material from '#models/material'
import Component from '#models/component'
import ProductAttachment from '#models/product_attachment'
import Customer from '#models/customer'
import Order from '#models/order'
import Invoice from '#models/invoice'

// ── helpers ────────────────────────────────────────────────────────────────

let seq = 0
function uniq(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now()}-${seq}-${Math.floor(Math.random() * 9999)}`
}

/**
 * Create a user holding the given permission keys via a dedicated role.
 * Pass an empty array for a user with no permissions at all.
 */
async function makeUser(permissions: string[], overrides: Partial<User> = {}): Promise<User> {
  const user = await User.create({
    email: uniq('u') + '@test.com',
    password: 'Passw0rd!',
    firstName: 'T',
    lastName: 'U',
    isOwner: false,
    ...overrides,
  } as Partial<User>)

  if (permissions.length) {
    const role = await Role.create({
      name: uniq('role'),
      displayName: 'Test Role',
      isSystem: false,
      parentRoleId: null,
    })
    await role.syncPermissions(permissions)
    await user.related('roles').attach([role.id])
  }
  return user
}

/** Write bytes to the faked disk and return the key. */
async function putObject(key: string, bytes = 'PNGDATA-bytes'): Promise<string> {
  await drive.use().put(key, bytes)
  return key
}

async function makeProduct(imageKey: string | null = null): Promise<Product> {
  return Product.create({
    sku: uniq('SKU'),
    name: 'Test Product',
    isActive: true,
    imageKey,
  } as Partial<Product>)
}

// ── tests ──────────────────────────────────────────────────────────────────

test.group('File streaming — product image', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('authed user with products.view gets 200 image with immutable cache', async ({
    client,
    assert,
  }) => {
    const user = await makeUser(['products.view'])
    const key = await putObject(`products/${uniq('img')}.png`)
    const product = await makeProduct(key)

    const res = await client.get(`/catalog/products/${product.id}/image`).loginAs(user)

    res.assertStatus(200)
    assert.include(res.header('content-type') ?? '', 'image/')
    assert.include(res.header('cache-control') ?? '', 'immutable')
    // Streamed binary lands in the response body as a Buffer, not text.
    assert.isTrue(Buffer.isBuffer(res.body()))
    assert.isAbove((res.body() as Buffer).length, 0)
  })

  test('unauthenticated request redirects to /login', async ({ client, assert }) => {
    const key = await putObject(`products/${uniq('img')}.png`)
    const product = await makeProduct(key)

    const res = await client.get(`/catalog/products/${product.id}/image`).redirects(0)

    res.assertStatus(302)
    assert.equal(res.header('location'), '/login')
  })

  test('authed user without products.view gets 403', async ({ client }) => {
    const user = await makeUser(['roles.view'])
    const key = await putObject(`products/${uniq('img')}.png`)
    const product = await makeProduct(key)

    const res = await client.get(`/catalog/products/${product.id}/image`).loginAs(user)

    res.assertStatus(403)
  })

  test('product with null imageKey gets 404', async ({ client }) => {
    const user = await makeUser(['products.view'])
    const product = await makeProduct(null)

    const res = await client.get(`/catalog/products/${product.id}/image`).loginAs(user)

    res.assertStatus(404)
  })
})

test.group('File streaming — product gallery', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  async function makeAttachment(
    productId: number,
    kind: 'image' | 'file',
    key: string
  ): Promise<ProductAttachment> {
    return ProductAttachment.create({
      productId,
      fileKey: key,
      originalName: 'pic.png',
      sizeBytes: 12,
      mimeType: 'image/png',
      uploadedByUserId: null,
      kind,
      sortOrder: 0,
    } as Partial<ProductAttachment>)
  }

  test('gallery image belonging to product returns 200', async ({ client, assert }) => {
    const user = await makeUser(['products.view'])
    const product = await makeProduct()
    const key = await putObject(`products/gallery/${uniq('g')}.png`)
    const att = await makeAttachment(product.id, 'image', key)

    const res = await client.get(`/catalog/products/${product.id}/gallery/${att.id}`).loginAs(user)

    res.assertStatus(200)
    assert.include(res.header('content-type') ?? '', 'image/')
  })

  test('gallery image belonging to a different product returns 404', async ({ client }) => {
    const user = await makeUser(['products.view'])
    const productA = await makeProduct()
    const productB = await makeProduct()
    const key = await putObject(`products/gallery/${uniq('g')}.png`)
    const att = await makeAttachment(productB.id, 'image', key)

    const res = await client.get(`/catalog/products/${productA.id}/gallery/${att.id}`).loginAs(user)

    res.assertStatus(404)
  })

  test('gallery attachment whose kind is not image returns 404', async ({ client }) => {
    const user = await makeUser(['products.view'])
    const product = await makeProduct()
    const key = await putObject(`products/files/${uniq('f')}.png`)
    const att = await makeAttachment(product.id, 'file', key)

    const res = await client.get(`/catalog/products/${product.id}/gallery/${att.id}`).loginAs(user)

    res.assertStatus(404)
  })
})

test.group('File streaming — product file download', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('download returns 200 with attachment disposition and no-store', async ({
    client,
    assert,
  }) => {
    const user = await makeUser(['products.view'])
    const product = await makeProduct()
    const key = await putObject(`products/files/${uniq('f')}.pdf`, 'PDF-bytes')
    const att = await ProductAttachment.create({
      productId: product.id,
      fileKey: key,
      originalName: 'datasheet.pdf',
      sizeBytes: 9,
      mimeType: 'application/pdf',
      uploadedByUserId: null,
      kind: 'file',
      sortOrder: 0,
    } as Partial<ProductAttachment>)

    const res = await client
      .get(`/catalog/products/${product.id}/files/${att.id}/download`)
      .loginAs(user)

    res.assertStatus(200)
    const disposition = res.header('content-disposition') ?? ''
    assert.include(disposition, 'attachment')
    assert.include(disposition, 'datasheet.pdf')
    assert.include(res.header('cache-control') ?? '', 'no-store')
  })

  test('download of a file belonging to a different product returns 404', async ({ client }) => {
    const user = await makeUser(['products.view'])
    const productA = await makeProduct()
    const productB = await makeProduct()
    const key = await putObject(`products/files/${uniq('f')}.pdf`, 'PDF-bytes')
    const att = await ProductAttachment.create({
      productId: productB.id,
      fileKey: key,
      originalName: 'x.pdf',
      sizeBytes: 9,
      mimeType: 'application/pdf',
      uploadedByUserId: null,
      kind: 'file',
      sortOrder: 0,
    } as Partial<ProductAttachment>)

    const res = await client
      .get(`/catalog/products/${productA.id}/files/${att.id}/download`)
      .loginAs(user)

    res.assertStatus(404)
  })
})

test.group('File streaming — material & component images', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('material image with materials.view returns 200', async ({ client, assert }) => {
    const user = await makeUser(['materials.view'])
    const key = await putObject(`materials/${uniq('m')}.png`)
    const material = await Material.create({
      sku: uniq('MAT'),
      name: 'Test Material',
      unit: 'kg',
      isActive: true,
      imageKey: key,
    } as Partial<Material>)

    const res = await client.get(`/catalog/materials/${material.id}/image`).loginAs(user)

    res.assertStatus(200)
    assert.include(res.header('content-type') ?? '', 'image/')
    assert.include(res.header('cache-control') ?? '', 'immutable')
  })

  test('component image with components.view returns 200', async ({ client, assert }) => {
    const user = await makeUser(['components.view'])
    const key = await putObject(`components/${uniq('c')}.png`)
    const component = await Component.create({
      sku: uniq('CMP'),
      name: 'Test Component',
      unit: 'pcs',
      isActive: true,
      imageKey: key,
    } as Partial<Component>)

    const res = await client.get(`/catalog/components/${component.id}/image`).loginAs(user)

    res.assertStatus(200)
    assert.include(res.header('content-type') ?? '', 'image/')
  })
})

test.group('File streaming — avatars', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('own avatar via /profile/avatar returns 200 when set', async ({ client, assert }) => {
    const key = await putObject(`avatars/${uniq('a')}.png`)
    const user = await makeUser([], { avatarKey: key } as Partial<User>)

    const res = await client.get('/profile/avatar').loginAs(user)

    res.assertStatus(200)
    assert.include(res.header('content-type') ?? '', 'image/')
  })

  test('own avatar returns 404 when not set', async ({ client }) => {
    const user = await makeUser([])

    const res = await client.get('/profile/avatar').loginAs(user)

    res.assertStatus(404)
  })

  test('users/:id/avatar for self returns 200 without users.view', async ({ client }) => {
    const key = await putObject(`avatars/${uniq('a')}.png`)
    const user = await makeUser([], { avatarKey: key } as Partial<User>)

    const res = await client.get(`/users/${user.id}/avatar`).loginAs(user)

    res.assertStatus(200)
  })

  test('users/:id/avatar for another user without users.view returns 403', async ({ client }) => {
    const actor = await makeUser([])
    const key = await putObject(`avatars/${uniq('a')}.png`)
    const target = await makeUser([], { avatarKey: key } as Partial<User>)

    const res = await client.get(`/users/${target.id}/avatar`).loginAs(actor)

    res.assertStatus(403)
  })

  test('users/:id/avatar for another user with users.view returns 200', async ({ client }) => {
    const actor = await makeUser(['users.view'])
    const key = await putObject(`avatars/${uniq('a')}.png`)
    const target = await makeUser([], { avatarKey: key } as Partial<User>)

    const res = await client.get(`/users/${target.id}/avatar`).loginAs(actor)

    res.assertStatus(200)
  })
})

test.group('File streaming — invoice PDF download', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  /**
   * Build a minimal invoice whose PDF is already cached on disk. Pre-setting
   * `pdfKey` makes the controller's `ensurePdf` short-circuit, so no React
   * document render is triggered — we exercise only the streaming path.
   */
  async function makeInvoiceWithPdf(): Promise<{ invoice: Invoice; key: string }> {
    const customer = await Customer.create({
      name: uniq('Cust'),
      isActive: true,
    } as Partial<Customer>)
    const order = await Order.create({
      number: uniq('ORD'),
      customerId: customer.id,
      status: 'confirmed',
    } as Partial<Order>)
    const key = await putObject(`invoices/${uniq('inv')}.pdf`, '%PDF-1.4 fake')
    const invoice = await Invoice.create({
      number: uniq('INV'),
      orderId: order.id,
      customerId: customer.id,
      status: 'unpaid',
      issuedAt: DateTime.now(),
      dueAt: DateTime.now().plus({ days: 14 }),
      pdfKey: key,
    } as Partial<Invoice>)
    return { invoice, key }
  }

  test('invoice download streams application/pdf with 200 (not a 302 redirect)', async ({
    client,
    assert,
  }) => {
    const user = await makeUser(['invoices.view'])
    const { invoice } = await makeInvoiceWithPdf()

    const res = await client.get(`/invoices/${invoice.id}/download`).redirects(0).loginAs(user)

    res.assertStatus(200)
    assert.notEqual(res.status(), 302)
    assert.include(res.header('content-type') ?? '', 'application/pdf')
    assert.include(res.header('content-disposition') ?? '', 'attachment')
    assert.include(res.header('cache-control') ?? '', 'no-store')
  })

  test('invoice download without invoices.view returns 403', async ({ client }) => {
    const user = await makeUser(['products.view'])
    const { invoice } = await makeInvoiceWithPdf()

    const res = await client.get(`/invoices/${invoice.id}/download`).loginAs(user)

    res.assertStatus(403)
  })
})
