# Module Toggles & Workflow Configuration

Lets an owner/admin enable or disable business modules from **Settings → Modules**
(`/system/modules`) so the panel matches a business's actual workflow. Disabling a
module hides it from navigation, blocks its routes/APIs, and trims cross-module
touchpoints — **without deleting data** (re-enabling restores everything).

## Concepts

- **Module flag (global)** vs **permission (per-role)** are independent gates;
  **both** must pass for a feature to be usable. A disabled module is hidden for
  everyone, owners included, regardless of permission.
- The set of enabled modules is stored in `app_settings` under the key
  `enabled_modules` (a JSON array), cached for 1h via the shared cache service.
- Dependencies are **enforced**, so a hard cross-module seam (e.g. a sale writing
  stock) can never point at a disabled module. This is why "adaptive workflow"
  needs no business-logic rewrite — just route/nav gating + graceful degradation.

## The registry

Single source of truth: `app/services/modules/registry.ts`. Shipped to the
frontend (Settings page + nav) so the client never re-declares it.

| key | label | stage | depends on | owns routes |
|-----|-------|-------|-----------|-------------|
| `inventory` | Inventory | inventory (spine) | — | `/inventory` |
| `purchase` | Purchase | purchase | `inventory` | `/purchases`, `/suppliers` |
| `manufacturing` | Manufacturing | manufacturing | `inventory` | `/jobs` |
| `machines` | Machines | (chip of manufacturing) | `manufacturing` | `/machines` |
| `labour` | Labour | (chip of manufacturing) | `manufacturing` | `/workers` |
| `orders` | Orders | sales | `inventory`, `invoices` | `/orders`, `/customers` |
| `invoices` | Invoices | (chip of orders) | — | `/invoices` |
| `quotations` | Quotations | (chip of orders) | `orders` | `/quotations` |
| `pos` | POS | (chip of orders) | `orders`, `inventory`, `invoices` | `/pos` |
| `reports` | Reports | overview | — | `/reports` |

**Always-on core (never toggleable):** Dashboard, Catalog (`/catalog/*`), System
(`/system/*`, incl. this page), Profile. A business with zero modules can still log
in, manage catalog, and configure the system.

**Presets** (match the workflow sketches): Wholesale (`purchase, inventory, orders,
invoices, quotations, reports`), Manufacturer (all), Artisan (`purchase, inventory,
manufacturing, labour, orders, invoices, quotations, reports` — hand work, no
machines), Retail (`inventory, orders, invoices, pos, reports`).

**Labour** adds workers paid hourly or by monthly salary. Monthly workers are
costed into jobs at a derived rate (`monthly_salary / standard_monthly_hours`),
so both pay types produce comparable per-job COGS. A job may run on a machine,
on people, or both — `startJob` only requires that at least one is assigned.

**Dependency rules** — a module may be enabled only if all its `dependsOn` are
enabled. The UI auto-enables dependencies when you turn a module on, and
cascade-disables dependents when you turn a dependency off. The backend
(`setEnabledModules`) re-validates and rejects any invalid selection.

## How it's wired

- **Storage/service:** `app/models/app_setting.ts`,
  `app/services/modules/module_service.ts` (`getEnabledModules`,
  `isModuleEnabled`, `setEnabledModules`, `assertModulesEnabled`). Cache bust +
  `audit_events` row on every change.
- **Route gating:** `app/middleware/ensure_module_middleware.ts`, registered as
  named middleware `module` in `start/kernel.ts`. In `start/routes.ts` each
  module's routes are wrapped in a group with `.use(middleware.module({ module: '<key>' }))`.
  Disabled → GET redirects to `/dashboard` with a flash, non-GET → 404.
- **Permission:** `settings.view` + `settings.manageModules` (in
  `start/permissions.ts`), seeded to Owner + Admin (not Member). The settings
  controller authorizes via bouncer.
- **Shared prop:** `app/middleware/inertia_middleware.ts` shares
  `enabledModules: string[]` to every page.
- **Nav:** `inertia/components/sidebar_nav.ts` tags each item with `module`;
  `inertia/lib/nav.ts` `isVisible()` requires both permission and module enabled.
- **Settings UI:** `inertia/pages/system/modules.tsx` +
  `inertia/components/modules/module-pipeline.tsx` (visual pipeline + presets).
- **Safety-net guard:** `applyMovement()` in `inventory_service.ts` asserts the
  `inventory` module is enabled — the single chokepoint every stock change funnels
  through.

## Adding a new toggleable module

1. Add an entry to `MODULES` in `registry.ts` (key, label, stage, `dependsOn`,
   `routePrefixes`, icon). Add the key to `MODULE_KEYS`.
2. Wrap its routes in a `middleware.module({ module: '<key>' })` group in
   `start/routes.ts`.
3. Tag its nav items with `module: '<key>'` in `sidebar_nav.ts`.
4. If a lucide icon name is new, add it to the `ICONS` map in `module-pipeline.tsx`.
5. Add it to relevant presets. Run `node ace migration:run && node ace db:seed`.

## Tests

- `tests/unit/services/module_registry.spec.ts` — dependency validation, cascade,
  closure, preset consistency.
- `tests/functional/settings/modules.spec.ts` — permission gating, route blocking,
  invalid-selection rejection, persistence + audit.
