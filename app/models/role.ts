// app/models/role.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
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
   * Hierarchy weight. Higher = more privileged. Owners are treated as
   * +Infinity at runtime; the seeded system roles are 100/50/10.
   */
  @column()
  declare priority: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
