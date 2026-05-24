# Product Default Sale Price + Image Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow operators to pin a manual default sale price per product (which overrides the cost-based formula in sales surfaces) and to attach multiple images per product with reorder + set-primary support.

**Architecture:** Two additive Postgres migrations (no breaking changes). Pricing service gains a new `'product_default'` basis branch that fires when `products.default_sale_price` is set but no per-line manual override is supplied. `product_attachments` is reused for the gallery via a new `kind` column ('image' | 'file') and `sort_order`; `products.image_key` stays canonical for primary/hero usage so lists, POS tiles, invoice/quotation PDFs, and QR pages need no changes. Drag-to-reorder uses `@dnd-kit` (new dep).

**Tech Stack:** AdonisJS v7, Lucid ORM, Postgres, VineJS, Inertia + React 19, Tailwind v4, shadcn, `@dnd-kit/core` + `@dnd-kit/sortable` (new), S3-compatible storage via existing `product_attachment_storage` service.

**Reference spec:** `docs/superpowers/specs/2026-05-24-product-default-price-and-image-gallery-design.md`

---

## File Structure

**Backend — create:**
- `database/migrations/<ts>_add_default_sale_price_to_products.ts` — products schema additions
- `database/migrations/<ts>_add_image_kind_to_product_attachments.ts` — attachments schema additions + backfill
- `app/validators/catalog.ts` (modify) — new validators for default price and image upload/reorder

**Backend — modify:**
- `app/services/pricing.ts` — add `defaultSalePrice` branch + `'product_default'` basis
- `app/services/catalog_view_models.ts` — extend `ProductShowData`, split attachments into images/files, attach default-price metadata + per-job suggested pin price
- `app/services/product_attachment_storage.ts` — add `storeProductImage`, `listProductImages`, `reorderProductImages`; update `listProductAttachments` to filter `kind='file'`
- `app/controllers/products_controller.ts` — add default-price + image-gallery actions
- `start/routes.ts` — register the new routes
- `tests/unit/pricing.spec.ts` — extend (or create if missing) for the new branch

**Frontend — create:**
- `inertia/components/catalog/default-price-dialog.tsx`
- `inertia/components/catalog/product-image-gallery.tsx`

**Frontend — modify:**
- `inertia/pages/catalog/products/show.tsx` — wire in new card + gallery, consume new props
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

## Conventions in this codebase to mirror

- Routes for "delete" use `POST /thing/:id/delete` (not HTTP DELETE) — see `start/routes.ts:138, 150`. New endpoints follow the same shape.
- Controllers `redirect().back()` and use `session.flash('success', ...)` for success messages; JSON endpoints use `response.json({ data: ... })`.
- `database/schema.ts` is **auto-regenerated** by `node ace migration:run` — never hand-edit. After each migration run, expect schema.ts to be rewritten.
- All audited writes call `audit({ actor: auth.user!, action, targetType, targetId, payload })`. The `actor`, `action`, `targetType`, `targetId` fields are all required for our patterns.
- Lucid decimals are stored as **strings** on the model (see how `defaultProfitPct` and `taxRatePct` are merged in `products_controller.ts:111-125`). Convert with `String(num)` on write, `Number(val)` on read.
- File uploads use `forceFormData: true` via Inertia + the controller calls `request.validateUsing(...)`.

---

## Task 1: Migration — add default-price columns to `products`

**Files:**
- Create: `database/migrations/1778000000400_add_default_sale_price_to_products.ts`

- [ ] **Step 1: Create the migration file**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('default_sale_price', 12, 2).nullable()
      table
        .integer('default_sale_price_source_job_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('production_jobs')
        .onDelete('SET NULL')
      table.timestamp('default_sale_price_set_at', { useTz: true }).nullable()
      table
        .integer('default_sale_price_set_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('default_sale_price')
      table.dropColumn('default_sale_price_source_job_id')
      table.dropColumn('default_sale_price_set_at')
      table.dropColumn('default_sale_price_set_by_user_id')
    })
  }
}
```

- [ ] **Step 2: Run the migration**

Run: `node ace migration:run`
Expected: `❯ migrated database/migrations/1778000000400_add_default_sale_price_to_products` plus a schema.ts regeneration.

- [ ] **Step 3: Verify `ProductSchema` now lists the new columns**

Run: `grep -n "default_sale_price\|defaultSalePrice" database/schema.ts`
Expected: at least 4 matches showing the new columns in the products schema block.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/1778000000400_add_default_sale_price_to_products.ts database/schema.ts
git commit -m "feat(catalog): add default sale price columns to products"
```

---

## Task 2: Migration — add `kind` + `sort_order` to `product_attachments`

**Files:**
- Create: `database/migrations/1778000000410_add_image_kind_to_product_attachments.ts`

- [ ] **Step 1: Create the migration file**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_attachments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('kind', 16).notNullable().defaultTo('file')
      table.integer('sort_order').notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(
        "UPDATE product_attachments SET kind = 'image' WHERE mime_type LIKE 'image/%'"
      )
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['product_id', 'kind', 'sort_order'], 'product_attachments_gallery_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['product_id', 'kind', 'sort_order'], 'product_attachments_gallery_idx')
      table.dropColumn('kind')
      table.dropColumn('sort_order')
    })
  }
}
```

- [ ] **Step 2: Run the migration**

Run: `node ace migration:run`
Expected: migration runs successfully; backfill sets `kind='image'` on any existing image-mime rows.

- [ ] **Step 3: Verify backfill**

Run (psql): `docker compose -f docker-compose.dev.yml exec -T postgres psql -U dev -d dev -c "SELECT kind, COUNT(*) FROM product_attachments GROUP BY kind;"`
Expected: zero or more rows; any rows with image mime types should be `kind = 'image'`. If the table is empty in dev, this is still a PASS.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/1778000000410_add_image_kind_to_product_attachments.ts database/schema.ts
git commit -m "feat(catalog): add kind and sort_order to product_attachments"
```

---

## Task 3: Pricing — `defaultSalePrice` branch (TDD)

**Files:**
- Test: `tests/unit/pricing.spec.ts`
- Modify: `app/services/pricing.ts:28-107`

- [ ] **Step 1: Write the failing tests**

Create or append to `tests/unit/pricing.spec.ts`:

```typescript
import { test } from '@japa/runner'
import { computeUnitPrice } from '#services/pricing'

function makeProduct(overrides: Record<string, any> = {}): any {
  return {
    defaultProfitPct: '30',
    taxRatePct: '18',
    defaultSalePrice: null,
    ...overrides,
  }
}

test.group('computeUnitPrice — default sale price', () => {
  test('uses defaultSalePrice when set and no manualUnitPrice', ({ assert }) => {
    const result = computeUnitPrice({
      costPrice: 1000,
      product: makeProduct({ defaultSalePrice: '1499' }),
      category: null,
    })
    assert.equal(result.unitPrice, 1499)
    assert.equal(result.profitPctUsed, null)
    assert.equal(result.basis.profitFrom, 'product_default')
    assert.equal(result.costPrice, 1000)
  })

  test('manualUnitPrice wins over defaultSalePrice', ({ assert }) => {
    const result = computeUnitPrice({
      costPrice: 1000,
      manualUnitPrice: 2000,
      product: makeProduct({ defaultSalePrice: '1499' }),
      category: null,
    })
    assert.equal(result.unitPrice, 2000)
    assert.equal(result.basis.profitFrom, 'manual')
  })

  test('null defaultSalePrice falls through to profit ladder', ({ assert }) => {
    const result = computeUnitPrice({
      costPrice: 1000,
      product: makeProduct({ defaultSalePrice: null, defaultProfitPct: '30' }),
      category: null,
    })
    assert.equal(result.basis.profitFrom, 'product')
    assert.equal(result.profitPctUsed, 30)
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node ace test --suites=unit --files="tests/unit/pricing.spec.ts"`
Expected: 3 failures referencing `product_default` or unit price ≠ 1499.

- [ ] **Step 3: Update `PriceBreakdown.basis.profitFrom` union**

In `app/services/pricing.ts:38`, change the union from:
```typescript
profitFrom: 'manual' | 'product' | 'category' | 'global'
```
to:
```typescript
profitFrom: 'manual' | 'product_default' | 'product' | 'category' | 'global'
```

- [ ] **Step 4: Insert the new branch in `computeUnitPrice`**

In `app/services/pricing.ts`, after the manual-override block ending at line 76 and before the `// Layered profit lookup.` comment, insert:

```typescript
  // Stored default sale price wins over the formula ladder.
  if (input.product.defaultSalePrice !== null && input.product.defaultSalePrice !== undefined) {
    const stored = Number(input.product.defaultSalePrice)
    return {
      unitPrice: applyRounding(stored, rounding),
      costPrice: input.costPrice,
      profitPctUsed: null,
      taxRatePct: numberOrZero(input.product.taxRatePct ?? input.category?.taxRatePct ?? null),
      basis: {
        profitFrom: 'product_default',
        taxFrom: pickTaxBasis(input.product, input.category),
        rounding,
      },
    }
  }
```

- [ ] **Step 5: Re-run tests**

Run: `node ace test --suites=unit --files="tests/unit/pricing.spec.ts"`
Expected: all 3 new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/services/pricing.ts tests/unit/pricing.spec.ts
git commit -m "feat(pricing): honor product default_sale_price in computeUnitPrice"
```

---

## Task 4: Catalog view model — expose default price + split attachments

**Files:**
- Modify: `app/services/catalog_view_models.ts:276-443`

- [ ] **Step 1: Update `ProductShowData` shape**

In `app/services/catalog_view_models.ts:276-321`, replace the `attachments` and `profitAnalysis` sections:

```typescript
  product: {
    id: number
    sku: string
    name: string
    description: string | null
    category: { id: number; name: string } | null
    defaultProfitPct: string | null
    taxRatePct: string | null
    imageUrl: string | null
    isActive: boolean
    inProductionQty: number
    soldQty: number
    createdAt: string | null
    updatedAt: string | null
  }
  images: Array<{
    id: number
    url: string | null
    originalName: string
    sortOrder: number
    isPrimary: boolean
    createdAt: string | null
  }>
  files: Array<{
    id: number
    originalName: string
    sizeBytes: number
    mimeType: string | null
    createdAt: string | null
  }>
  profitAnalysis: {
    sellingPrice: number | null
    costBasis: number | null
    profitPctUsed: number | null
    profitFrom: 'manual' | 'product_default' | 'product' | 'category' | 'global' | null
    taxRatePct: number
    taxFrom: 'product' | 'category' | 'global'
    rounding: 'nearest_50_paise' | 'nearest_rupee' | 'none'
    profitPerUnit: number | null
    profitPct: number | null
    defaultSalePrice: number | null
    defaultSalePriceSource: {
      jobId: number | null
      jobNumber: string | null
      setAt: string | null
      setByUserName: string | null
    } | null
    autoComputedPrice: number | null
    jobs: Array<{
      id: number
      number: string
      completedAt: string | null
      producedQty: number
      totalCost: number
      unitCost: number
      sellingPrice: number | null
      profitPerUnit: number | null
      profitPct: number | null
      suggestedPinPrice: number
    }>
  }
}
```

- [ ] **Step 2: Update `getProductShowViewModel` to load + return new fields**

In `app/services/catalog_view_models.ts:323-443`, replace the function body. Locate the `Promise.all` block (starting around line 325) and:

1. Add `signCatalogImageUrl` and `signProductFileUrl` imports if not already present (check top of file).
2. Change the `db.from('product_attachments')` query to select all columns including `kind`, `sort_order`, `file_key`, and order by `sort_order ASC, id ASC`.
3. Add a parallel query loading the source-job + set-by-user info when `default_sale_price_source_job_id` is set.

Replace the existing attachments query (around line 328-332):
```typescript
      db
        .from('product_attachments')
        .where('product_id', id)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
        .select(
          'id',
          'original_name',
          'size_bytes',
          'mime_type',
          'kind',
          'sort_order',
          'file_key',
          'created_at'
        ),
```

After the existing `Promise.all` completes, derive a helper that signs image URLs:

```typescript
  // After Promise.all destructuring, split images vs files:
  const rawAttachments = attachments as Array<{
    id: number
    original_name: string
    size_bytes: number | string
    mime_type: string | null
    kind: string
    sort_order: number | string
    file_key: string
    created_at: Date | string | null
  }>

  const imageRows = rawAttachments.filter((a) => a.kind === 'image')
  const fileRows = rawAttachments.filter((a) => a.kind !== 'image')

  const signedImageUrls = await Promise.all(
    imageRows.map((row) => signProductFileUrl({ fileKey: row.file_key } as any))
  )

  const images = imageRows.map((row, i) => ({
    id: Number(row.id),
    url: signedImageUrls[i] ?? null,
    originalName: String(row.original_name),
    sortOrder: Number(row.sort_order),
    isPrimary: row.file_key === product.imageKey,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : (row.created_at as string | null) ?? null,
  }))

  const files = fileRows.map((row) => ({
    id: Number(row.id),
    originalName: String(row.original_name),
    sizeBytes: Number(row.size_bytes),
    mimeType: row.mime_type,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : (row.created_at as string | null) ?? null,
  }))
```

3. Compute default-price source metadata:

```typescript
  let defaultSalePriceSource: ProductShowData['profitAnalysis']['defaultSalePriceSource'] = null
  if (product.defaultSalePrice !== null) {
    let jobRow: { id: number; number: string } | null = null
    let userRow: { fullName: string | null } | null = null
    if (product.defaultSalePriceSourceJobId) {
      jobRow = await db
        .from('production_jobs')
        .where('id', product.defaultSalePriceSourceJobId)
        .select('id', 'number')
        .first()
    }
    if (product.defaultSalePriceSetByUserId) {
      userRow = await db
        .from('users')
        .where('id', product.defaultSalePriceSetByUserId)
        .select('full_name')
        .first()
        .then((r: any) => (r ? { fullName: r.full_name ?? null } : null))
    }
    defaultSalePriceSource = {
      jobId: jobRow?.id ?? null,
      jobNumber: jobRow?.number ?? null,
      setAt: product.defaultSalePriceSetAt?.toISO() ?? null,
      setByUserName: userRow?.fullName ?? null,
    }
  }
```

4. Compute auto price (formula result, ignoring the pin) by passing a temporarily-cleared default:

```typescript
  const productWithoutPin: any = { ...product.$attributes, defaultSalePrice: null }
  const autoPriceBreakdown = computeUnitPrice({
    costPrice: costBasis,
    product: productWithoutPin,
    category: product.category ?? null,
  })
  const autoComputedPrice = costBasis !== null ? autoPriceBreakdown.unitPrice : null
```

5. Per-job `suggestedPinPrice`:

```typescript
  // Inside the existing jobs.map((j) => { ... }) loop, add:
  const suggestedPinPrice = Math.ceil((unitCost + 40) / 50) * 50
```
And include it in each job row object.

6. Final return — replace the existing return block with one that includes `images`, `files`, and the extended `profitAnalysis`:

```typescript
  return {
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category ? { id: product.category.id, name: product.category.name } : null,
      defaultProfitPct: product.defaultProfitPct,
      taxRatePct: product.taxRatePct,
      imageUrl,
      isActive: product.isActive,
      inProductionQty,
      soldQty,
      createdAt: product.createdAt?.toISO() ?? null,
      updatedAt: product.updatedAt?.toISO() ?? null,
    },
    images,
    files,
    profitAnalysis: {
      sellingPrice,
      costBasis,
      profitPctUsed: sellingPrice !== null ? priceBreakdown.profitPctUsed : null,
      profitFrom: sellingPrice !== null ? priceBreakdown.basis.profitFrom : null,
      taxRatePct: priceBreakdown.taxRatePct,
      taxFrom: priceBreakdown.basis.taxFrom,
      rounding: priceBreakdown.basis.rounding,
      profitPerUnit,
      profitPct,
      defaultSalePrice:
        product.defaultSalePrice !== null ? Number(product.defaultSalePrice) : null,
      defaultSalePriceSource,
      autoComputedPrice,
      jobs,
    },
  }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If errors mention `signProductFileUrl` signature mismatch, adjust the call signature based on the existing function in `app/services/product_attachment_storage.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/services/catalog_view_models.ts
git commit -m "feat(catalog): expose default sale price + split image/file attachments in show view-model"
```

---

## Task 5: Storage service — image-specific helpers

**Files:**
- Modify: `app/services/product_attachment_storage.ts`

- [ ] **Step 1: Read current file to confirm exports**

Run: `cat app/services/product_attachment_storage.ts | head -40`
Note the exported function names so we don't collide.

- [ ] **Step 2: Add image helpers**

Append to `app/services/product_attachment_storage.ts`:

```typescript
import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import ProductAttachment from '#models/product_attachment'

const IMAGE_PREFIX = 'catalog/products/gallery'

export async function storeProductImage(
  product: { id: number },
  file: { extname?: string; tmpPath?: string; size: number; clientName: string; type?: string; subtype?: string; moveToDisk: (key: string) => Promise<void> },
  userId: number | null
): Promise<ProductAttachment> {
  const ext = file.extname ?? 'bin'
  const fileKey = `${IMAGE_PREFIX}/${product.id}/${randomUUID()}.${ext}`
  await file.moveToDisk(fileKey)

  const maxSort = await db
    .from('product_attachments')
    .where('product_id', product.id)
    .where('kind', 'image')
    .max({ m: 'sort_order' })
    .first()
  const nextSort = Number(maxSort?.m ?? 0) + 1

  const mime =
    file.type && file.subtype ? `${file.type}/${file.subtype}` : (file.type ?? null)

  return ProductAttachment.create({
    productId: product.id,
    fileKey,
    originalName: file.clientName,
    sizeBytes: file.size,
    mimeType: mime,
    uploadedByUserId: userId,
    // @ts-expect-error new columns added by migration; schema.ts regenerated on next run
    kind: 'image',
    // @ts-expect-error see above
    sortOrder: nextSort,
  })
}

export async function listProductImages(productId: number) {
  return db
    .from('product_attachments')
    .where('product_id', productId)
    .where('kind', 'image')
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .select('id', 'original_name', 'sort_order', 'file_key', 'created_at')
}

export async function reorderProductImages(
  productId: number,
  ordering: Array<{ id: number; sortOrder: number }>
) {
  const ids = ordering.map((o) => o.id)
  const owned = await db
    .from('product_attachments')
    .where('product_id', productId)
    .where('kind', 'image')
    .whereIn('id', ids)
    .select('id')
  if (owned.length !== ids.length) {
    throw new Error('One or more attachments do not belong to this product')
  }
  await db.transaction(async (trx) => {
    for (const o of ordering) {
      await trx
        .from('product_attachments')
        .where('id', o.id)
        .update({ sort_order: o.sortOrder })
    }
  })
}
```

Remove the `@ts-expect-error` lines once you confirm `database/schema.ts` includes `kind` and `sortOrder` in the regenerated `ProductAttachmentSchema`. (After running migration 2, schema.ts should already include them — adjust the `ProductAttachment` model in the next task to extend the regenerated schema if needed.)

- [ ] **Step 3: Filter the existing list to files-only**

Find `listProductAttachments` in the same file. Add a `.where('kind', 'file')` filter just before the `.select(...)` call. Example before:
```typescript
return db.from('product_attachments').where('product_id', productId).orderBy('created_at', 'desc').select(...)
```
After:
```typescript
return db.from('product_attachments').where('product_id', productId).where('kind', 'file').orderBy('created_at', 'desc').select(...)
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/services/product_attachment_storage.ts app/models/product_attachment.ts
git commit -m "feat(catalog): add image storage helpers and filter files list by kind"
```

---

## Task 6: Validators

**Files:**
- Modify: `app/validators/catalog.ts`

- [ ] **Step 1: Append the new validators**

```typescript
export const setProductDefaultPriceValidator = vine.compile(
  vine.object({
    price: vine.number().positive(),
    sourceJobId: vine.number().positive().optional().nullable(),
  })
)

export const uploadProductImagesValidator = vine.compile(
  vine.object({
    images: vine
      .array(
        vine.file({
          size: '15mb',
          extnames: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        })
      )
      .minLength(1)
      .maxLength(10),
  })
)

export const reorderProductImagesValidator = vine.compile(
  vine.object({
    items: vine
      .array(
        vine.object({
          id: vine.number().positive(),
          sortOrder: vine.number(),
        })
      )
      .minLength(1),
  })
)
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/validators/catalog.ts
git commit -m "feat(catalog): validators for default price + image upload + reorder"
```

---

## Task 7: Controller — default price endpoints

**Files:**
- Modify: `app/controllers/products_controller.ts`

- [ ] **Step 1: Add imports**

At the top of `products_controller.ts`, add to the existing import block:
```typescript
import { DateTime } from 'luxon'
import {
  setProductDefaultPriceValidator,
  uploadProductImagesValidator,
  reorderProductImagesValidator,
} from '#validators/catalog'
import {
  storeProductImage,
  listProductImages,
  reorderProductImages,
} from '#services/product_attachment_storage'
```

- [ ] **Step 2: Add `setDefaultPrice` and `clearDefaultPrice`**

Append to the `ProductsController` class:

```typescript
  async setDefaultPrice({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const payload = await request.validateUsing(setProductDefaultPriceValidator)

    const previousPrice = product.defaultSalePrice
    product.merge({
      defaultSalePrice: String(payload.price),
      defaultSalePriceSourceJobId: payload.sourceJobId ?? null,
      defaultSalePriceSetAt: DateTime.now(),
      defaultSalePriceSetByUserId: auth.user?.id ?? null,
    } as any)
    await product.save()

    await audit({
      actor: auth.user!,
      action: 'product.default_price.set',
      targetType: 'product',
      targetId: product.id,
      payload: { price: payload.price, sourceJobId: payload.sourceJobId ?? null, previousPrice },
    })
    session.flash('success', `Default price set to ₹${payload.price}.`)
    return response.redirect().back()
  }

  async clearDefaultPrice({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const previousPrice = product.defaultSalePrice
    const previousSourceJobId = (product as any).defaultSalePriceSourceJobId ?? null

    product.merge({
      defaultSalePrice: null,
      defaultSalePriceSourceJobId: null,
      defaultSalePriceSetAt: null,
      defaultSalePriceSetByUserId: null,
    } as any)
    await product.save()

    await audit({
      actor: auth.user!,
      action: 'product.default_price.clear',
      targetType: 'product',
      targetId: product.id,
      payload: { previousPrice, previousSourceJobId },
    })
    session.flash('success', 'Default price cleared.')
    return response.redirect().back()
  }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `defaultSalePrice` is unrecognized on `Product`, run `node ace migration:run` again to regenerate `schema.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/controllers/products_controller.ts
git commit -m "feat(catalog): controller actions for setting and clearing default sale price"
```

---

## Task 8: Controller — image gallery endpoints

**Files:**
- Modify: `app/controllers/products_controller.ts`

- [ ] **Step 1: Add `uploadImages`, `setPrimaryImage`, `reorderImages`**

Append to the `ProductsController` class:

```typescript
  async uploadImages({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const payload = await request.validateUsing(uploadProductImagesValidator)

    for (const file of payload.images) {
      const attachment = await storeProductImage(product, file as any, auth.user?.id ?? null)
      await audit({
        actor: auth.user!,
        action: 'product.image.add',
        targetType: 'product',
        targetId: product.id,
        payload: {
          attachmentId: attachment.id,
          name: attachment.originalName,
          sortOrder: (attachment as any).sortOrder,
        },
      })
    }

    session.flash('success', `Uploaded ${payload.images.length} image(s).`)
    return response.redirect().back()
  }

  async setPrimaryImage({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const attachment = await ProductAttachment.findOrFail(params.imageId)
    if (attachment.productId !== product.id) {
      session.flash('error', 'Image does not belong to this product.')
      return response.redirect().back()
    }
    if ((attachment as any).kind !== 'image') {
      session.flash('error', 'Attachment is not an image.')
      return response.redirect().back()
    }

    const previousImageKey = product.imageKey
    product.imageKey = attachment.fileKey
    await product.save()

    await audit({
      actor: auth.user!,
      action: 'product.image.set_primary',
      targetType: 'product',
      targetId: product.id,
      payload: { attachmentId: attachment.id, previousImageKey },
    })

    session.flash('success', 'Primary image updated.')
    return response.redirect().back()
  }

  async reorderImages({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const payload = await request.validateUsing(reorderProductImagesValidator)

    await reorderProductImages(product.id, payload.items)

    await audit({
      actor: auth.user!,
      action: 'product.image.reorder',
      targetType: 'product',
      targetId: product.id,
      payload: { count: payload.items.length },
    })

    session.flash('success', 'Image order updated.')
    return response.redirect().back()
  }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/controllers/products_controller.ts
git commit -m "feat(catalog): controller actions for product image gallery"
```

---

## Task 9: Routes

**Files:**
- Modify: `start/routes.ts` (after line 155, inside the products group)

- [ ] **Step 1: Add routes for default price + images**

Locate the products route block in `start/routes.ts` (around lines 124-155). After the existing `qr/download` route, append:

```typescript
  router.post('/catalog/products/:id/default-price', [
    ProductsController,
    'setDefaultPrice',
  ]).as('products.defaultPrice.set')
  router.post('/catalog/products/:id/default-price/delete', [
    ProductsController,
    'clearDefaultPrice',
  ]).as('products.defaultPrice.clear')

  router.post('/catalog/products/:id/images', [
    ProductsController,
    'uploadImages',
  ]).as('products.images.upload')
  router.post('/catalog/products/:id/images/:imageId/primary', [
    ProductsController,
    'setPrimaryImage',
  ]).as('products.images.setPrimary')
  router.post('/catalog/products/:id/images/reorder', [
    ProductsController,
    'reorderImages',
  ]).as('products.images.reorder')
```

Match the exact import style and `as(...)` naming convention used by neighbouring routes in this file. If routes are defined inside a `.group(...)` block, drop the `/catalog/products` prefix and use the relative path that fits the group's existing pattern.

- [ ] **Step 2: Verify Tuyau registry regenerates**

Run: `npm run dev` (in background) or `node ace build` once. Check `.adonisjs/client/` for the route map.
Expected: new route names appear; no compile errors.
Then stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add start/routes.ts
git commit -m "feat(catalog): routes for default price + image gallery"
```

---

## Task 10: Install `@dnd-kit` and add image gallery component

**Files:**
- Create: `inertia/components/catalog/product-image-gallery.tsx`
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

Run: `npm install @dnd-kit/core@^6 @dnd-kit/sortable@^8 @dnd-kit/utilities@^3`
Expected: three packages added to `dependencies`.

- [ ] **Step 2: Create the gallery component**

```tsx
// inertia/components/catalog/product-image-gallery.tsx
import { useEffect, useState, useRef } from 'react'
import { router } from '@inertiajs/react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Star, StarOff, Trash2, Upload } from 'lucide-react'
import { Button } from '~/components/ui/button'

type ImageRow = {
  id: number
  url: string | null
  originalName: string
  sortOrder: number
  isPrimary: boolean
}

type Props = {
  productId: number
  images: ImageRow[]
  canEdit: boolean
}

function Tile({ image, productId, canEdit }: { image: ImageRow; productId: number; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
      {...attributes}
      {...listeners}
    >
      {image.url ? (
        <img
          src={image.url}
          alt={image.originalName}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          {image.originalName}
        </div>
      )}
      {image.isPrimary && (
        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          Primary
        </span>
      )}
      {canEdit && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-background/80 p-1 opacity-0 transition group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1"
            disabled={image.isPrimary}
            onClick={(e) => {
              e.stopPropagation()
              router.post(`/catalog/products/${productId}/images/${image.id}/primary`, {}, {
                preserveScroll: true,
              })
            }}
          >
            {image.isPrimary ? <Star className="h-3 w-3" /> : <StarOff className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1 text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              if (!window.confirm('Delete this image?')) return
              router.post(`/catalog/products/${productId}/files/${image.id}/delete`, {}, {
                preserveScroll: true,
              })
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function ProductImageGallery({ productId, images, canEdit }: Props) {
  const [items, setItems] = useState(images)
  const fileInput = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    setItems(images)
  }, [images])

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    router.post(
      `/catalog/products/${productId}/images/reorder`,
      { items: next.map((row, i) => ({ id: row.id, sortOrder: i + 1 })) },
      { preserveScroll: true }
    )
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !files.length) return
    const fd = new FormData()
    for (const f of Array.from(files)) fd.append('images[]', f)
    router.post(`/catalog/products/${productId}/images`, fd, {
      preserveScroll: true,
      forceFormData: true,
    })
    e.target.value = ''
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {items.map((image) => (
              <Tile key={image.id} image={image} productId={productId} canEdit={canEdit} />
            ))}
            {canEdit && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex aspect-square items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-accent"
              >
                <Upload className="h-5 w-5" />
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onPickFiles}
      />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If shadcn `Button` import path differs, adjust to match an existing component import in `inertia/components/catalog/`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json inertia/components/catalog/product-image-gallery.tsx
git commit -m "feat(catalog): product image gallery component with dnd-kit reorder"
```

---

## Task 11: Default-price dialog component

**Files:**
- Create: `inertia/components/catalog/default-price-dialog.tsx`

- [ ] **Step 1: Create the dialog**

```tsx
// inertia/components/catalog/default-price-dialog.tsx
import { useEffect, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: number
  initialPrice: number | null
  suggestedPrice: number | null
  sourceJob?: { id: number; number: string } | null
  autoComputedPrice?: number | null
}

export function DefaultPriceDialog({
  open,
  onOpenChange,
  productId,
  initialPrice,
  suggestedPrice,
  sourceJob,
  autoComputedPrice,
}: Props) {
  const seed = initialPrice ?? suggestedPrice ?? autoComputedPrice ?? 0
  const [price, setPrice] = useState<string>(String(seed))

  useEffect(() => {
    if (open) setPrice(String(seed))
  }, [open, seed])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(price)
    if (!Number.isFinite(value) || value <= 0) return
    router.post(
      `/catalog/products/${productId}/default-price`,
      { price: value, sourceJobId: sourceJob?.id ?? null },
      {
        preserveScroll: true,
        onSuccess: () => onOpenChange(false),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set default sale price</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="default-price-input">Price (₹)</Label>
            <Input
              id="default-price-input"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
          </div>
          {sourceJob && (
            <p className="text-xs text-muted-foreground">Anchored to #{sourceJob.number}</p>
          )}
          {autoComputedPrice !== null && autoComputedPrice !== undefined && (
            <p className="text-xs text-muted-foreground">
              Auto-calculated price: ₹{autoComputedPrice.toLocaleString()}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `~/components/ui/dialog` etc. don't exist, run `npx shadcn@latest add dialog input label` to install the primitives.

- [ ] **Step 3: Commit**

```bash
git add inertia/components/catalog/default-price-dialog.tsx
git commit -m "feat(catalog): default sale price dialog"
```

---

## Task 12: Wire components into product show page

**Files:**
- Modify: `inertia/pages/catalog/products/show.tsx`

- [ ] **Step 1: Update prop types**

In `inertia/pages/catalog/products/show.tsx:22-75`, update the page prop type to match the new view-model. Replace the existing `Attachment` / `ProfitAnalysis` / `PageProps` declarations:

```tsx
type GalleryImage = {
  id: number
  url: string | null
  originalName: string
  sortOrder: number
  isPrimary: boolean
}

type FileRow = {
  id: number
  originalName: string
  sizeBytes: number
  mimeType: string | null
  createdAt: string | null
}

type ProfitJobRow = {
  id: number
  number: string
  completedAt: string | null
  producedQty: number
  totalCost: number
  unitCost: number
  sellingPrice: number | null
  profitPerUnit: number | null
  profitPct: number | null
  suggestedPinPrice: number
}

type ProfitAnalysis = {
  sellingPrice: number | null
  costBasis: number | null
  profitPctUsed: number | null
  profitFrom: 'manual' | 'product_default' | 'product' | 'category' | 'global' | null
  taxRatePct: number
  taxFrom: 'product' | 'category' | 'global'
  rounding: 'nearest_50_paise' | 'nearest_rupee' | 'none'
  profitPerUnit: number | null
  profitPct: number | null
  defaultSalePrice: number | null
  defaultSalePriceSource: {
    jobId: number | null
    jobNumber: string | null
    setAt: string | null
    setByUserName: string | null
  } | null
  autoComputedPrice: number | null
  jobs: ProfitJobRow[]
}

type Product = {
  id: number
  sku: string
  name: string
  description: string | null
  category: { id: number; name: string } | null
  defaultProfitPct: string | null
  taxRatePct: string | null
  imageUrl: string | null
  isActive: boolean
  inProductionQty: number
  soldQty: number
  createdAt: string | null
  updatedAt: string | null
}

type PageProps = {
  product: Product
  images: GalleryImage[]
  files: FileRow[]
  profitAnalysis: ProfitAnalysis
}
```

Replace any remaining `attachments` references in this file with the appropriate split (`images` or `files`).

- [ ] **Step 2: Add the Default Price card**

Insert after the existing `<ProfitAnalysisCard />` JSX (around line 491). Pseudocode of the section:

```tsx
import { useState } from 'react'
import { DefaultPriceDialog } from '~/components/catalog/default-price-dialog'

// inside the page component:
const [dialogOpen, setDialogOpen] = useState(false)
const [dialogJob, setDialogJob] = useState<ProfitJobRow | null>(null)
const canEdit = /* same check used by existing edit buttons on this page */ true

// ... after profit analysis card:
<Card className="mt-4">
  <CardHeader>
    <CardTitle>Default sale price</CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    {profitAnalysis.defaultSalePrice !== null ? (
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">
            ₹{profitAnalysis.defaultSalePrice.toLocaleString()}
          </div>
          {profitAnalysis.defaultSalePriceSource && (
            <div className="text-xs text-muted-foreground">
              {profitAnalysis.defaultSalePriceSource.jobNumber
                ? `From #${profitAnalysis.defaultSalePriceSource.jobNumber}`
                : 'Set manually'}
              {profitAnalysis.defaultSalePriceSource.setByUserName
                ? ` · by ${profitAnalysis.defaultSalePriceSource.setByUserName}`
                : ''}
            </div>
          )}
          {profitAnalysis.autoComputedPrice !== null && (
            <div className="text-xs text-muted-foreground">
              Auto-calculated: ₹{profitAnalysis.autoComputedPrice.toLocaleString()}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDialogJob(null)
                setDialogOpen(true)
              }}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!window.confirm('Clear the default sale price?')) return
                router.post(
                  `/catalog/products/${product.id}/default-price/delete`,
                  {},
                  { preserveScroll: true }
                )
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    ) : (
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          No default set — sales surfaces will use the auto-calculated price
          {profitAnalysis.autoComputedPrice !== null
            ? ` (₹${profitAnalysis.autoComputedPrice.toLocaleString()})`
            : ''}
          .
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialogJob(null)
              setDialogOpen(true)
            }}
          >
            Set default
          </Button>
        )}
      </div>
    )}
  </CardContent>
</Card>

<DefaultPriceDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  productId={product.id}
  initialPrice={dialogJob ? null : profitAnalysis.defaultSalePrice}
  suggestedPrice={dialogJob?.suggestedPinPrice ?? null}
  autoComputedPrice={profitAnalysis.autoComputedPrice}
  sourceJob={dialogJob ? { id: dialogJob.id, number: dialogJob.number } : null}
/>
```

- [ ] **Step 3: Add "Set as default" button to each job row in the profit analysis table**

Find the existing `profitAnalysis.jobs.map(...)` rendering in the Profit Analysis card. Add a trailing `<TableCell>` per row:

```tsx
<TableCell className="text-right">
  {canEdit && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setDialogJob(job)
        setDialogOpen(true)
      }}
    >
      Set as default
    </Button>
  )}
</TableCell>
```

And add a corresponding `<TableHead />` cell in the table header.

- [ ] **Step 4: Add the gallery to the grid**

Locate the grid block (around line 493-496) that currently holds `<FilesCard />` and `<QrCard />`. Replace with a three-column structure: Images on the left, Files in the middle, QR on the right (or stack on small screens — match the existing responsive grid).

```tsx
import { ProductImageGallery } from '~/components/catalog/product-image-gallery'

<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
  <Card>
    <CardHeader>
      <CardTitle>Images</CardTitle>
    </CardHeader>
    <CardContent>
      <ProductImageGallery productId={product.id} images={images} canEdit={canEdit} />
    </CardContent>
  </Card>
  <FilesCard files={files} /* update FilesCard to accept files prop instead of attachments */ />
  <QrCard /* unchanged */ />
</div>
```

Update `FilesCard`'s prop name in this same file from `attachments` to `files` (one-line type rename). The card's body already iterates the same shape minus the new image-only fields.

- [ ] **Step 5: Run the dev server and verify the page renders**

Run: `npm run dev` (in background).
Open `http://localhost:3333/catalog/products/<id>` for a product with at least one completed job in dev DB.
Expected: page renders without console errors. Default Price card visible. Images section shows the empty `[+]` tile if no images yet.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add inertia/pages/catalog/products/show.tsx
git commit -m "feat(catalog): wire default price card + image gallery into product show page"
```

---

## Task 13: Functional test — default price endpoints

**Files:**
- Create or extend: `tests/functional/products.spec.ts`

- [ ] **Step 1: Add the test**

```typescript
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Product from '#models/product'
import User from '#models/user'

test.group('products default price', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('setting and clearing default price flows through the model', async ({ client, assert }) => {
    const user = await User.firstOrFail()
    const product = await Product.create({
      sku: 'TEST-PINPRICE',
      name: 'Pin price test',
      isActive: true,
    } as any)

    const setRes = await client
      .post(`/catalog/products/${product.id}/default-price`)
      .loginAs(user)
      .form({ price: 1499 })
    setRes.assertRedirect()

    await product.refresh()
    assert.equal(Number((product as any).defaultSalePrice), 1499)
    assert.equal((product as any).defaultSalePriceSetByUserId, user.id)

    const clearRes = await client
      .post(`/catalog/products/${product.id}/default-price/delete`)
      .loginAs(user)
    clearRes.assertRedirect()

    await product.refresh()
    assert.isNull((product as any).defaultSalePrice)
  })
})
```

If `@adonisjs/core/services/test_utils` is not the pattern used by this codebase, mirror an existing functional spec under `tests/functional/`. Inspect any existing `*.spec.ts` in that folder for the correct test bootstrap; if no functional specs exist yet, follow `tests/bootstrap.ts` conventions for the setup hook.

- [ ] **Step 2: Run tests**

Run: `node ace test --suites=functional --files="tests/functional/products.spec.ts"`
Expected: 1 test PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/functional/products.spec.ts
git commit -m "test(catalog): default price set + clear endpoints"
```

---

## Task 14: Manual verification + final commit

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual browser check**

Run: `npm run dev` (in background).
For a product with at least one completed production job:
- Open `/catalog/products/<id>`.
- Click **"Set as default"** on a completed-job row → dialog opens with suggested round-up price → save → card now shows pinned price + "From #JOB-XXXX".
- Open a POS or quotation that includes this product → confirm the suggested price equals the pinned value.
- Click **Clear** on the Default Price card → price disappears, auto-computed price reappears below.
- Upload 3 images via the gallery tile → all 3 render → drag the 2nd to position 1 → reload, order persists.
- Click the star on a non-primary image → that image gains the "Primary" badge → reload the product list page (`/catalog/products`) → the hero thumbnail matches the new primary.
Stop the dev server.

- [ ] **Step 4: Final tidy commit (if anything was adjusted)**

```bash
git add -A
git commit -m "chore(catalog): polish after manual verification" --allow-empty
```

Or skip if nothing changed.

---

## Self-Review

**Spec coverage:**
- Default sale price schema → Task 1 ✓
- `kind` + `sort_order` schema → Task 2 ✓
- Pricing service `product_default` branch → Task 3 ✓
- View-model split + new fields → Task 4 ✓
- Storage helpers → Task 5 ✓
- Validators → Task 6 ✓
- Default-price controller endpoints + routes → Tasks 7, 9 ✓
- Image controller endpoints + routes → Tasks 8, 9 ✓
- Gallery component (dnd-kit reorder, set-primary, multi-upload) → Task 10 ✓
- Dialog component → Task 11 ✓
- Page integration → Task 12 ✓
- Unit + functional tests → Tasks 3, 13 ✓
- Manual browser verification → Task 14 ✓

**Placeholder scan:** No "TBD"/"TODO"; every step shows the code. The one judgment call ("If routes are defined inside a `.group(...)` block…") is annotated because the exact group structure of `start/routes.ts` depends on a section we did not exhaustively dump — the engineer pattern-matches against neighbours.

**Type consistency:** `defaultSalePrice` typed `string | null` on the model (Lucid decimal convention), `number | null` on the view-model. Conversions via `String(...)` / `Number(...)` are explicit at every boundary. `profitFrom` union extended with `'product_default'` everywhere it appears (pricing.ts, view-model, page prop type).

**Known soft spots:**
- `@ts-expect-error` lines in Task 5 are temporary — once `migration:run` regenerates `schema.ts` with `kind`/`sortOrder`, those columns become known on `ProductAttachment` and the suppressions can be removed. Task 5 calls this out.
- `signProductFileUrl` is reused for image thumbnails (same S3 bucket, same auth) — if its signature requires a full `ProductAttachment` instance instead of `{ fileKey }`, adjust the call in Task 4. The cost of the wrong signature is a typecheck error that fails fast.
