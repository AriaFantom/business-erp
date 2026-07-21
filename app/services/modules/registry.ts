/**
 * Module registry — the single source of truth for which business modules
 * exist, how they depend on each other, which routes/nav they own, and how the
 * Settings pipeline UI should lay them out.
 *
 * Disabling a module hides it from navigation, blocks its routes, and trims
 * cross-module touchpoints (dashboard widgets, reports, pricing). Dependencies
 * are enforced so a *hard* seam (e.g. a sale writing stock) can never point at a
 * disabled module.
 *
 * This metadata is shipped to the frontend (Settings page + nav) so the client
 * never has to re-declare it. Keep this file free of runtime/DB concerns — those
 * live in `module_service.ts`.
 */

export const MODULE_KEYS = [
  'inventory',
  'purchase',
  'manufacturing',
  'machines',
  'orders',
  'invoices',
  'quotations',
  'pos',
  'reports',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

/** Pipeline stages, left-to-right, matching the workflow sketch. */
export type PipelineStage = 'purchase' | 'manufacturing' | 'inventory' | 'sales' | 'overview'

export interface ModuleDef {
  key: ModuleKey
  label: string
  description: string
  /** Which pipeline column this module renders in. */
  stage: PipelineStage
  /** When set, render as a chip beneath the parent stage node (UI grouping only). */
  parent?: ModuleKey
  /** Hard dependencies — every listed module must also be enabled. */
  dependsOn: ModuleKey[]
  /** Route path prefixes this module owns (used by the gating middleware). */
  routePrefixes: string[]
  /** lucide-react icon name, resolved on the frontend. */
  icon: string
}

export const MODULES: ModuleDef[] = [
  {
    key: 'inventory',
    label: 'Inventory',
    description:
      'On-hand stock, valuations and manual adjustments. The spine every flow runs through.',
    stage: 'inventory',
    dependsOn: [],
    routePrefixes: ['/inventory'],
    icon: 'Warehouse',
  },
  {
    key: 'purchase',
    label: 'Purchase',
    description:
      'Suppliers and purchase orders. Confirming a purchase brings stock into inventory.',
    stage: 'purchase',
    dependsOn: ['inventory'],
    routePrefixes: ['/purchases', '/suppliers'],
    icon: 'Truck',
  },
  {
    key: 'manufacturing',
    label: 'Manufacturing',
    description:
      'Production jobs that consume materials and produce finished goods into inventory.',
    stage: 'manufacturing',
    dependsOn: ['inventory'],
    routePrefixes: ['/jobs'],
    icon: 'Factory',
  },
  {
    key: 'machines',
    label: 'Machines',
    description: 'Machine register, maintenance and machine expenses.',
    stage: 'manufacturing',
    parent: 'manufacturing',
    dependsOn: ['manufacturing'],
    routePrefixes: ['/machines'],
    icon: 'Cpu',
  },
  {
    key: 'orders',
    label: 'Orders',
    description:
      'Customers and sales orders. Confirming an order draws stock and issues an invoice.',
    stage: 'sales',
    dependsOn: ['inventory', 'invoices'],
    routePrefixes: ['/orders', '/customers'],
    icon: 'ShoppingCart',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Invoices and payments generated from orders.',
    stage: 'sales',
    parent: 'orders',
    dependsOn: [],
    routePrefixes: ['/invoices'],
    icon: 'Receipt',
  },
  {
    key: 'quotations',
    label: 'Quotations',
    description: 'Customer quotes that can be converted into orders.',
    stage: 'sales',
    parent: 'orders',
    dependsOn: ['orders'],
    routePrefixes: ['/quotations'],
    icon: 'FileText',
  },
  {
    key: 'pos',
    label: 'POS',
    description: 'Point-of-sale terminal for instant sale + invoice + payment.',
    stage: 'sales',
    parent: 'orders',
    dependsOn: ['orders', 'inventory', 'invoices'],
    routePrefixes: ['/pos'],
    icon: 'Store',
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Profit, inventory and job reports across the enabled modules.',
    stage: 'overview',
    dependsOn: [],
    routePrefixes: ['/reports'],
    icon: 'ClipboardList',
  },
]

const MODULE_BY_KEY = new Map<ModuleKey, ModuleDef>(MODULES.map((m) => [m.key, m]))

export function getModule(key: ModuleKey): ModuleDef | undefined {
  return MODULE_BY_KEY.get(key)
}

export function isModuleKey(value: string): value is ModuleKey {
  return MODULE_BY_KEY.has(value as ModuleKey)
}

/** Stable order, dropping any unknown keys. */
export function normalizeKeys(keys: string[]): ModuleKey[] {
  return MODULE_KEYS.filter((k) => keys.includes(k))
}

/**
 * Workflow presets matching the three flows from the design sketch. Each lists
 * the user-facing modules; dependencies are added automatically by the UI/service.
 */
export interface ModulePreset {
  key: string
  label: string
  description: string
  modules: ModuleKey[]
}

export const PRESETS: ModulePreset[] = [
  {
    key: 'wholesale',
    label: 'Wholesale',
    description: 'Buy and resell: Purchase → Inventory → Order.',
    modules: ['purchase', 'inventory', 'orders', 'invoices', 'quotations', 'reports'],
  },
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    description: 'Full chain: Purchase → Manufacturing → Inventory → Sale.',
    modules: [...MODULE_KEYS],
  },
  {
    key: 'retail',
    label: 'Retail',
    description: 'Sell from stock: Inventory → Sale.',
    modules: ['inventory', 'orders', 'invoices', 'pos', 'reports'],
  },
]

// ── Pure dependency helpers (no DB, no cache) ────────────────────────────────

export interface DependencyViolation {
  module: ModuleKey
  missing: ModuleKey[]
}

/**
 * Returns dependency violations for a desired-enabled set: any enabled module
 * whose dependencies are not all present. An empty array means the selection is
 * valid.
 */
export function validateSelection(enabled: ModuleKey[]): DependencyViolation[] {
  const set = new Set(enabled)
  const violations: DependencyViolation[] = []
  for (const key of enabled) {
    const def = MODULE_BY_KEY.get(key)
    if (!def) continue
    const missing = def.dependsOn.filter((d) => !set.has(d))
    if (missing.length > 0) violations.push({ module: key, missing })
  }
  return violations
}

/**
 * Given a desired-enabled set, remove any module whose dependencies are not all
 * present, repeating until stable. Models "turning a dependency off cascades to
 * its dependents" — returns a guaranteed-valid subset.
 */
export function resolveCascade(enabled: ModuleKey[]): ModuleKey[] {
  let set = new Set(normalizeKeys(enabled))
  let changed = true
  while (changed) {
    changed = false
    for (const key of [...set]) {
      const def = MODULE_BY_KEY.get(key)!
      if (def.dependsOn.some((d) => !set.has(d))) {
        set.delete(key)
        changed = true
      }
    }
  }
  return MODULE_KEYS.filter((k) => set.has(k))
}

/**
 * Additive closure: enabling a module pulls in all of its (transitive)
 * dependencies. Models "turning a module on auto-enables what it needs".
 */
export function resolveEnable(enabled: ModuleKey[]): ModuleKey[] {
  const set = new Set(normalizeKeys(enabled))
  let changed = true
  while (changed) {
    changed = false
    for (const key of [...set]) {
      for (const dep of MODULE_BY_KEY.get(key)!.dependsOn) {
        if (!set.has(dep)) {
          set.add(dep)
          changed = true
        }
      }
    }
  }
  return MODULE_KEYS.filter((k) => set.has(k))
}

/** Modules that hard-depend on `key` (its direct dependents). */
export function dependentsOf(key: ModuleKey): ModuleKey[] {
  return MODULES.filter((m) => m.dependsOn.includes(key)).map((m) => m.key)
}
