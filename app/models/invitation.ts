import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { InvitationSchema } from '#database/schema'
import Role from '#models/role'

export default class Invitation extends InvitationSchema {
  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>
}
