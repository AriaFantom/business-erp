# Product default sale price + multiple product images

Date: 2026-05-24
Status: Approved

## Background

Today every selling price in the app is recomputed from `latest completed-job unit cost × (1 + profit%)`, layered defaults coming from product → category → global env. There is no way to "pin" a sale price that the operator finds psychologically right (e.g. cost ₹1,459 → sell at ₹1,499). Every quotation, POS sale and invoice line auto-suggests the formula price, forcing manual edits.

Products also currently support a **single** image via `products.image_key`. The `product_attachments` table exists but treats everything as a generic file (no image-specific affordance, no gallery, no ordering, no "set as primary").

This spec adds:

1. A stored **default sale price** that, when set, takes precedence over the cost-based formula in all sales-side surfaces, while keeping the cost-based computation available for display/context.
2. A **multi-image gallery** per product, reusing the existing attachments table, with the current `products.image_key` continuing to act as the canonical primary image used by lists / POS tiles / PDFs.

## Goals

- Operators with `products.update` permission can pin a default sale price for any product, optionally anchored to a specific completed production job (for provenance display).
- The pinned price is what shows up by default in quotations, POS, sales and invoices. The cost-based "auto-calculated" price still computes underneath, for the profit-analysis panel and for fallback when the pin is cleared.
- Operators can upload multiple images per product, reorder them, delete them, and promote any of them to primary.
- No breaking change to the existing single-image consumers (lists, POS tiles, invoice/quotation PDFs, QR pages) — they keep reading `products.image_key`.

## Non-goals

- Per-variant default prices (no variant model exists in this codebase).
- Bulk image import from CSV / URLs.
- Currency rounding/strategy changes — keep the existing `nearest_50_paise` default.
- Automatic re-suggestion / "stale price" banner when latest job cost drifts above the stored default. Deferable; not required for v1.
- Migrating existing image-mime attachments into the gallery view automatically beyond backfilling the new `kind` column (they already belong to the product; the gallery just renders them).

## Data model changes

### `products` (alter)

Migration: `*_add_default_sale_price_to_products.ts`

| Column | Type | Notes |
|---|---|---|
| `default_sale_price` | DECIMAL(12,2) | Nullable. NULL → cost-based formula wins. |
| `default_sale_price_source_job_id` | INTEGER | Nullable FK → `production_jobs.id` ON DELETE SET NULL. Used for display only ("From #JOB-0042"). |
| `default_sale_price_set_at` | TIMESTAMPTZ | Nullable. Set on insert/update of the price; cleared on DELETE. |
| `default_sale_price_set_by_user_id` | INTEGER | Nullable FK → `users.id` ON DELETE SET NULL. |

No indexes needed; this is a single-row lookup off `products.id`.

### `product_attachments` (alter)

Migration: `*_add_image_kind_to_product_attachments.ts`

| Column | Type | Notes |
|---|---|---|
| `kind` | VARCHAR(16) NOT NULL DEFAULT `'file'` | Values: `'image'`, `'file'`. Enforced in the validator (no DB check constraint — matches existing convention in this codebase). |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | Stable, asc-ordered gallery. |

Backfill in the same migration: `UPDATE product_attachments SET kind = 'image' WHERE mime_type LIKE 'image/%'`.

Add a composite index `(product_id, kind, sort_order)` to support the gallery query path.

### `products.image_key` — unchanged

Stays as the canonical primary-image pointer used by every existing surface (lists, POS tiles, invoice/quotation PDFs, QR pages, share targets). The gallery shows it as the **first** image with a "Primary" badge. Promoting a gallery image to primary copies its `file_key` into `products.image_key` (the previously-primary file is preserved as a normal gallery attachment row so nothing is lost on toggle).

## Backend changes

### Pricing service

`app/services/pricing.ts` — extend `PriceBreakdown.basis.profitFrom` with a new value `'product_default'` and extend `computeUnitPrice`:

- If `input.manualUnitPrice` is provided → unchanged (manual wins, as today).
- **Else if `input.product.defaultSalePrice` is non-null** → return that price as `unitPrice` (still applies the rounding rule, in case a stored value somehow has a stray fraction). `costPrice` is still attached for display. `profitPctUsed` is `null`. `basis.profitFrom = 'product_default'`.
- Else → existing layered profit-pct ladder.

`computeUnitPrice` is already called by:

- `app/services/quotation_service.ts`
- `app/services/sale_service.ts`
- `app/services/pos_service.ts`
- `app/services/invoice_service.ts` (via quotation/sale lineage)
- `app/services/catalog_view_models.ts` (for profit analysis)

All of them get the new behavior for free.

### Catalog view model (product show page)

`app/services/catalog_view_models.ts::getProductShowViewModel` — extend the returned shape:

```ts
profitAnalysis: {
  // existing fields ...
  defaultSalePrice: number | null
  defaultSalePriceSource: {
    jobId: number | null
    jobNumber: string | null
    setAt: string | null
    setByUserName: string | null
  } | null
  autoComputedPrice: number | null   // explicit name, equals priceBreakdown.unitPrice when no pin
}
```

`sellingPrice` continues to reflect "what would be charged today" — i.e. `defaultSalePrice` when pinned, otherwise the cost-based result. The new `autoComputedPrice` field is always the formula result, used by the UI to show "Auto: ₹1,478" alongside the pinned default.

For each job row in `profitAnalysis.jobs`, also include `suggestedPinPrice` (round-up to next ₹50) so the dialog can pre-fill without a roundtrip.

### Controller / routes

`app/controllers/products_controller.ts` — new actions:

- `setDefaultPrice` — `POST /products/:id/default-price`, body `{ price: number, sourceJobId?: number | null }`. Gated on `products.update`. Audited as `product.default_price.set`.
- `clearDefaultPrice` — `DELETE /products/:id/default-price`. Gated on `products.update`. Audited as `product.default_price.clear`.
- `uploadImages` — `POST /products/:id/images`, multipart with one or more `images[]` files. Validator restricts to `image/*` mime types, max size matches existing avatar/catalog image config. Each upload creates a `product_attachments` row with `kind = 'image'`, `sort_order = max(sort_order)+1`.
- `setPrimaryImage` — `PATCH /products/:id/images/:imageId/primary`. Copies the attachment's `file_key` into `products.image_key`. Audited.
- `reorderImages` — `PATCH /products/:id/images/reorder`, body `[{ id, sortOrder }]`. Atomic transaction.

Image delete reuses the existing `destroyFile` action (no need to fork by kind — `removeProductFile` already handles S3 cleanup).

### Validators

`app/validators/catalog.ts`:

- `setProductDefaultPriceValidator` — `price: vine.number().positive()`, `sourceJobId: vine.number().optional().nullable()`.
- `uploadProductImagesValidator` — array of MultipartFile, each constrained to `extnames: ['jpg','jpeg','png','webp','gif']` and the same `size` limit used by `uploadCatalogImageValidator`.
- `reorderProductImagesValidator` — array of `{ id: number, sortOrder: number }`.

### Storage service

`app/services/product_attachment_storage.ts` — add:

- `storeProductImage(product, file, userId)` — sibling of `storeProductFile`, sets `kind = 'image'`, assigns next `sort_order`. Filename prefix `products/<id>/gallery/`.
- `listProductImages(productId)` — ordered by `sort_order ASC, id ASC`, returns signed thumbnail URLs (reuse `signProductFileUrl`; cache key per attachment).
- `reorderProductImages(productId, [{id, sortOrder}])` — wraps updates in a single transaction; validates all ids belong to the product.

Existing `listProductAttachments` should now filter to `kind = 'file'` so the existing "Files" panel stays files-only.

## Frontend changes

### `inertia/pages/catalog/products/show.tsx`

Profit analysis card gains a top row:

```
┌──────────────────────────────────────────────────────────┐
│ Default sale price                                       │
│  ₹1,499  ·  Pinned from #JOB-0042 · set by Asha · May 18 │
│  Auto-calculated: ₹1,478 (cost ₹1,137 + 30%)             │
│  [ Edit default ]  [ Clear default ]                     │
└──────────────────────────────────────────────────────────┘
```

When unset, the card shows `Auto-calculated: ₹1,478` with a single `[ Set default ]` button (no source-job prefilled).

The existing per-job row in the profit-analysis table gets a trailing **"Set as default"** button. Clicking it opens the same dialog pre-populated with `suggestedPinPrice` for that row and `sourceJobId` set to that job.

New components:

- `inertia/components/catalog/default-price-dialog.tsx` — controlled dialog with two fields: price (number) and an inline read-only summary of the source job (if any). Submits via Inertia `router.post` to `/products/:id/default-price`.
- `inertia/components/catalog/product-image-gallery.tsx` — grid of square thumbnails. Each tile: image, "Primary" badge if matches `image_key`, hover actions: **Set primary**, **Delete**. Drag-to-reorder via `@dnd-kit/sortable` (already a transitive dep — verify; if not, add). An "+ Add images" tile at the end opens a multi-file picker (the existing single-image uploader pattern, but allowing multiple).

### Product index page

No change to the product list — it keeps using `products.image_key`. The displayed price (if shown) should already flow through `computeUnitPrice` and so will respect the pin automatically.

### Quotation / POS / sale builders

No UI changes required — they already call the pricing endpoints which now return `defaultSalePrice` automatically. Optional polish (deferable): show a small "Default price" badge next to the suggested price input when the pin is active, so the operator knows it's a stored value rather than a fresh computation.

## Permissions

Both feature surfaces are gated by the existing `products.update` permission. No new abilities are introduced. Read paths (gallery viewing, default-price display) remain on `products.view`.

## Audit events

| Action key | Target | Payload |
|---|---|---|
| `product.default_price.set` | product | `{ price, sourceJobId, previousPrice }` |
| `product.default_price.clear` | product | `{ previousPrice, previousSourceJobId }` |
| `product.image.add` | product | `{ attachmentId, name, sortOrder }` |
| `product.image.set_primary` | product | `{ attachmentId, previousImageKey }` |
| `product.image.reorder` | product | `{ count }` |
| `product.image.delete` | product | uses existing `product.file.delete` (no change) |

## Testing

- **Unit** — `tests/unit/pricing.spec.ts`: extend with cases for (a) `defaultSalePrice` set → returned as `unitPrice` regardless of cost; (b) `manualUnitPrice` overrides `defaultSalePrice`; (c) `defaultSalePrice` null falls through to the existing ladder.
- **Functional** — `tests/functional/products.spec.ts`: POST/DELETE default-price endpoints (auth, validation, audit row), upload multiple images and verify ordering, set-primary swaps `image_key`, reorder persists `sort_order`.
- **Browser** — extend `tests/browser/products.spec.ts` (or add) with one happy-path: create product → upload 3 images → set 2nd as primary → verify list page hero image updated → pin a default price from a completed job → verify POS price input reflects the pin.

## Rollout

Two migrations, both forward-compatible (additive columns, defaults supplied). No data migration beyond the `kind` backfill. No env or config changes required. Ship behind no flag — the features are opt-in by user action.

## Open implementation notes

- The dnd-kit dependency: if not already in `package.json`, prefer `@dnd-kit/core` + `@dnd-kit/sortable` (small, accessible, matches the rest of the stack). Verify during plan execution before adding a new dep.
- "Set primary" semantics: when copying an attachment's `file_key` into `products.image_key`, do **not** delete the attachment row — the gallery should still show that image (it's just now also the primary). This avoids any need to "demote" the prior primary, since `image_key` is a string field, not a FK.
- The suggested round-up (`Math.ceil((cost + 40) / 50) * 50`) is intentionally simple and operator-overridable in the dialog. Tweak the formula later if operators complain; not worth a config knob in v1.
