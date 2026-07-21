import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { InvoiceSchema } from '#database/schema'
import Customer from '#models/customer'
import Order from '#models/order'
import User from '#models/user'
import InvoiceItem from '#models/invoice_item'
import InvoicePayment from '#models/invoice_payment'

export default class Invoice extends InvoiceSchema {
  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>

  @belongsTo(() => Order)
  declare order: BelongsTo<typeof Order>

  @hasMany(() => InvoiceItem)
  declare items: HasMany<typeof InvoiceItem>

  @hasMany(() => InvoicePayment)
  declare payments: HasMany<typeof InvoicePayment>

  @belongsTo(() => Invoice, { foreignKey: 'replacesInvoiceId' })
  declare replaces: BelongsTo<typeof Invoice>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>
}
