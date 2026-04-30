// app/models/role.ts
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { compose } from '@adonisjs/core/helpers'
import { withPermissions } from '#mixins/with_permissions'
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
}
