import type { PermissionKeys, ResourceMap } from './types.js'

export class Access<T extends ResourceMap> {
  #resolved = new Set<string>()

  constructor(
    private readonly activeKeys: Set<string>,
    private readonly aliasMap: Map<string, string>
  ) {}

  /** Resolve aliases, drop inactive/unknown, add to resolved set */
  use(rawKeys: string[]): this {
    for (const raw of rawKeys) {
      const canonical = this.aliasMap.get(raw) ?? raw
      if (this.activeKeys.has(canonical)) this.#resolved.add(canonical)
    }
    return this
  }

  allows(key: PermissionKeys<T>): boolean {
    return this.#resolved.has(key)
  }

  denies(key: PermissionKeys<T>): boolean {
    return !this.#resolved.has(key)
  }

  /** Token scoping: intersect resolved set with the token's allowed keys */
  scopeTo(scope: string[]): this {
    const scoped = new Set<string>()
    for (const raw of scope) {
      const canonical = this.aliasMap.get(raw) ?? raw
      if (this.#resolved.has(canonical)) scoped.add(canonical)
    }
    this.#resolved = scoped
    return this
  }

  permissions(): string[] {
    return [...this.#resolved]
  }
}
