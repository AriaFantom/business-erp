import cache from '@adonisjs/cache/services/main'
import AppSetting from '#models/app_setting'
import { audit } from '#services/audit'
import type User from '#models/user'
import {
  MODULE_KEYS,
  normalizeKeys,
  validateSelection,
  type DependencyViolation,
  type ModuleKey,
} from './registry.js'

/** Key under which the enabled-module list is stored in `app_settings`. */
export const ENABLED_MODULES_KEY = 'enabled_modules'
const CACHE_KEY = 'settings:enabled_modules'

/**
 * Thrown when a requested module selection leaves a module's hard dependency
 * unmet. Controllers map this to a flash message.
 */
export class ModuleDependencyError extends Error {
  constructor(readonly violations: DependencyViolation[]) {
    const detail = violations.map((v) => `${v.module} requires ${v.missing.join(', ')}`).join('; ')
    super(`Invalid module selection: ${detail}`)
    this.name = 'ModuleDependencyError'
  }
}

/**
 * The set of enabled modules for this install, cached (1h) like the role tree.
 * Defaults to "everything enabled" when unset, so a fresh/legacy install behaves
 * exactly as before the feature existed.
 */
export async function getEnabledModules(): Promise<ModuleKey[]> {
  return cache.getOrSet({
    key: CACHE_KEY,
    ttl: '1h',
    factory: async () => {
      const row = await AppSetting.findBy('key', ENABLED_MODULES_KEY)
      const raw = Array.isArray(row?.value) ? (row!.value as string[]) : [...MODULE_KEYS]
      return normalizeKeys(raw)
    },
  })
}

export async function isModuleEnabled(key: ModuleKey): Promise<boolean> {
  const enabled = await getEnabledModules()
  return enabled.includes(key)
}

/** True only if every listed module is enabled (used by cross-module guards). */
export async function areModulesEnabled(...keys: ModuleKey[]): Promise<boolean> {
  const enabled = new Set(await getEnabledModules())
  return keys.every((k) => enabled.has(k))
}

/**
 * Thrown by a service-layer safety-net guard when a workflow touches a disabled
 * module. With dependency enforcement these should never fire in practice — they
 * exist to prevent silent data corruption if settings ever drift.
 */
export class ModuleDisabledError extends Error {
  constructor(readonly module: ModuleKey) {
    super(`The "${module}" module is disabled.`)
    this.name = 'ModuleDisabledError'
  }
}

/** Throws `ModuleDisabledError` for the first disabled module in `keys`. */
export async function assertModulesEnabled(...keys: ModuleKey[]): Promise<void> {
  const enabled = new Set(await getEnabledModules())
  for (const key of keys) {
    if (!enabled.has(key)) throw new ModuleDisabledError(key)
  }
}

export async function invalidateEnabledModulesCache(): Promise<void> {
  await cache.delete({ key: CACHE_KEY })
}

/**
 * Persist a new enabled-module selection. Validates dependencies, writes the
 * setting, busts the cache, and records an audit event. Returns the normalized
 * set actually stored.
 */
export async function setEnabledModules(keys: string[], actor: User): Promise<ModuleKey[]> {
  const requested = normalizeKeys(keys)
  const violations = validateSelection(requested)
  if (violations.length > 0) throw new ModuleDependencyError(violations)

  const before = await getEnabledModules()
  const row = await AppSetting.updateOrCreate(
    { key: ENABLED_MODULES_KEY },
    { key: ENABLED_MODULES_KEY, value: requested, updatedBy: actor.id }
  )
  await invalidateEnabledModulesCache()
  await audit({
    actor,
    action: 'settings.modules.update',
    targetType: 'app_setting',
    targetId: row.id,
    payload: { before, after: requested },
  })
  return requested
}
