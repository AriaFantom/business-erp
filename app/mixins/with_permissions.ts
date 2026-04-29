import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'

export function withPermissions() {
  return <Model extends NormalizeConstructor<typeof BaseModel>>(superclass: Model) => {
    class WithPermissions extends superclass {
      @column({
        prepare: (value: string[]) => JSON.stringify(value ?? []),
        consume: (value: string | string[]) =>
          typeof value === 'string' ? JSON.parse(value) : (value ?? []),
      })
      declare permissions: string[]

      async givePermissions(keys: string[]) {
        const merged = new Set([...(this.permissions ?? []), ...keys])
        this.permissions = [...merged]
        await (this as any).save()
      }

      async syncPermissions(keys: string[]) {
        this.permissions = [...new Set(keys)]
        await (this as any).save()
      }

      async revokePermissions(keys: string[]) {
        const remove = new Set(keys)
        this.permissions = (this.permissions ?? []).filter((k) => !remove.has(k))
        await (this as any).save()
      }

      async getPermissions(): Promise<string[]> {
        return this.permissions ?? []
      }
    }
    return WithPermissions
  }
}
