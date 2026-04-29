import { Bouncer } from '@adonisjs/bouncer'
import { Access } from './access.js'
import type { ActionConfig, PermissionDefinition, PermissionKeys, ResourceMap } from './types.js'

interface Entity {
  getPermissions(): Promise<string[]>
}

export class Permissions<T extends ResourceMap> {
  readonly #defs: PermissionDefinition[] = []
  readonly #activeKeys: Set<string> = new Set()
  readonly #aliasMap: Map<string, string> = new Map() // alias → canonical
  #abilitiesCache?: Record<string, ReturnType<typeof Bouncer.ability>>

  constructor(map: T) {
    for (const resource of Object.keys(map)) {
      for (const action of Object.keys(map[resource])) {
        const cfg = map[resource][action] as ActionConfig
        const key = `${resource}.${action}`
        const def = this.#normalize(key, cfg)
        this.#defs.push(def)
        if (!def.inactive) this.#activeKeys.add(key)
        for (const alias of def.aliases) this.#aliasMap.set(alias, key)
      }
    }
  }

  #normalize(key: string, cfg: ActionConfig): PermissionDefinition {
    if (cfg === true) return { key, description: key, inactive: false, aliases: [] }
    if (typeof cfg === 'string') return { key, description: cfg, inactive: false, aliases: [] }
    return {
      key,
      description: cfg.description ?? key,
      inactive: cfg.inactive ?? false,
      aliases: cfg.aliases ?? [],
    }
  }

  all(): readonly PermissionDefinition[] {
    return this.#defs
  }
  keys(): string[] {
    return this.#defs.map((d) => d.key)
  }
  active(): string[] {
    return [...this.#activeKeys]
  }

  /** Compile-time-checked key passthrough */
  getKey<K extends PermissionKeys<T>>(key: K): K {
    if (!this.#activeKeys.has(key) && !this.#defs.find((d) => d.key === key)) {
      throw new Error(`Unknown permission: ${key}`)
    }
    return key
  }

  /** Resolve a list of raw keys (from DB) → canonical active keys */
  filterKeys(rawKeys: string[]): string[] {
    const out = new Set<string>()
    for (const raw of rawKeys) {
      const canonical = this.#aliasMap.get(raw) ?? raw
      if (this.#activeKeys.has(canonical)) out.add(canonical)
    }
    return [...out]
  }

  createAccess(): Access<T> {
    return new Access<T>(this.#activeKeys, this.#aliasMap)
  }

  async createAccessFor(entity: Entity): Promise<Access<T>> {
    const raw = await entity.getPermissions()
    return this.createAccess().use(raw)
  }

  /** Auto-generate one Bouncer ability per active permission */
  abilities(): Record<string, ReturnType<typeof Bouncer.ability>> {
    if (this.#abilitiesCache) return this.#abilitiesCache
    const out: Record<string, ReturnType<typeof Bouncer.ability>> = {}
    for (const key of this.#activeKeys) {
      out[key] = Bouncer.ability(async (user: Entity, scope?: string[]) => {
        const access = await this.createAccessFor(user)
        if (scope) access.scopeTo(scope)
        return access.allows(key as any)
      })
    }
    this.#abilitiesCache = out
    return out
  }
}

export function definePermissions<T extends ResourceMap>(map: T): Permissions<T> {
  return new Permissions(map)
}
