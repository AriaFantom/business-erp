import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { AuditEventSchema } from '#database/schema'
import User from '#models/user'

export default class AuditEvent extends AuditEventSchema {
  @belongsTo(() => User, { foreignKey: 'actorUserId' })
  declare actor: BelongsTo<typeof User>
}
