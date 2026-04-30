// app/models/role.ts
import { BaseModel, afterDelete, afterSave, beforeSave, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { compose } from '@adonisjs/core/helpers'
import { withPermissions } from '#mixins/with_permissions'
import { cycleCheck, getTree, invalidateTreeCache } from '#services/role_hierarchy'
import { DateTime } from 'luxon'

export default class Role extends compose(BaseModel, withPermissions()) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare displayName: string

  @column()
  declare description: string | null

  @column()
  declare isSystem: boolean

  /**
   * Parent in the role tree. Null = root. Hierarchy is enforced via
   * recursive CTE checks in `app/services/role_hierarchy.ts`.
   */
  @column()
  declare parentRoleId: number | null

  @belongsTo(() => Role, { foreignKey: 'parentRoleId' })
  declare parent: BelongsTo<typeof Role>

  @hasMany(() => Role, { foreignKey: 'parentRoleId' })
  declare children: HasMany<typeof Role>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static async preventCycle(role: Role) {
    if (role.parentRoleId === null || role.parentRoleId === undefined) return

    if (role.id !== undefined && role.parentRoleId === role.id) {
      throw new Error('Role cannot be its own parent')
    }

    // Brand-new rows have no id and no children — no cycle is possible.
    if (role.id === undefined) return

    // Skip the tree fetch when parent didn't change.
    if (role.$dirty.parentRoleId === undefined) return

    const tree = await getTree()
    if (cycleCheck(role.id, role.parentRoleId, tree)) {
      throw new Error('Cycle detected in role hierarchy')
    }
  }

  @afterSave()
  static async bustTreeCache() {
    await invalidateTreeCache()
  }

  @afterDelete()
  static async bustTreeCacheOnDelete() {
    await invalidateTreeCache()
  }
}
