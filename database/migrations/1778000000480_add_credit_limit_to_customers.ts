import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('customers', (table) => {
      // Maximum open receivable (unpaid invoice balance) allowed before new
      // credit sales are blocked. NULL = no limit.
      table.decimal('credit_limit', 14, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable('customers', (table) => {
      table.dropColumn('credit_limit')
    })
  }
}
