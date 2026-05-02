import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sales'

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
      table
        .integer('quotation_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('quotations')
        .onDelete('SET NULL')
      // 'draft' | 'confirmed' | 'cancelled'
      table.string('status').notNullable().defaultTo('draft')
      table.timestamp('confirmed_at').nullable()
      table.decimal('subtotal', 14, 2).notNullable().defaultTo(0)
      table.decimal('tax_total', 14, 2).notNullable().defaultTo(0)
      table.decimal('total', 14, 2).notNullable().defaultTo(0)
      table.text('note').nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['status', 'created_at'])
      table.index(['customer_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
