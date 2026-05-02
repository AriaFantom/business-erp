import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quotations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('number').notNullable().unique()
      table
        .integer('customer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('customers')
        .onDelete('RESTRICT')
      // 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'
      table.string('status').notNullable().defaultTo('draft')
      table.timestamp('issued_at').notNullable()
      table.timestamp('valid_until').notNullable()
      table.decimal('subtotal', 14, 2).notNullable().defaultTo(0)
      table.decimal('tax_total', 14, 2).notNullable().defaultTo(0)
      table.decimal('total', 14, 2).notNullable().defaultTo(0)
      table.text('note').nullable()
      table.timestamp('sent_at').nullable()
      table.timestamp('accepted_at').nullable()
      table.timestamp('rejected_at').nullable()
      table.integer('converted_to_sale_id').unsigned().nullable()
      table.string('pdf_key').nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['status', 'issued_at'])
      table.index(['customer_id'])
      table.index(['valid_until'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
