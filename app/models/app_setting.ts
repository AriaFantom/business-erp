import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'

/**
 * Generic install-wide settings store (one row per `key`). The `value` column
 * holds arbitrary JSON, serialised as text so arrays and objects round-trip
 * reliably on Postgres (same pattern as `ResourceGrant.actions`).
 */
export default class AppSetting extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare key: string

  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? null),
    consume: (value: string | null) =>
      typeof value === 'string' ? JSON.parse(value) : (value ?? null),
  })
  declare value: any

  @column()
  declare updatedBy: number | null

  @belongsTo(() => User, { foreignKey: 'updatedBy' })
  declare updatedByUser: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
