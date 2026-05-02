import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { InvoicePaymentSchema } from '#database/schema'
import Invoice from '#models/invoice'
import User from '#models/user'

export default class InvoicePayment extends InvoicePaymentSchema {
  @belongsTo(() => Invoice)
  declare invoice: BelongsTo<typeof Invoice>

  @belongsTo(() => User, { foreignKey: 'recordedByUserId' })
  declare recordedBy: BelongsTo<typeof User>
}
