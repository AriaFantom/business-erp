import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'purchases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('number').notNullable().unique()
      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('RESTRICT')
      // 'draft' | 'confirmed' | 'cancelled'
      table.string('status').notNullable().defaultTo('draft')
      table.timestamp('purchased_at').notNullable()
      table.decimal('subtotal', 14, 2).notNullable().defaultTo(0)
      table.decimal('tax_total', 14, 2).notNullable().defaultTo(0)
      table.decimal('total', 14, 2).notNullable().defaultTo(0)
      table.text('note').nullable()
      table.string('attachment_key').nullable()
      table.timestamp('confirmed_at').nullable()
      table
        .integer('confirmed_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('cancelled_at').nullable()
      table
        .integer('cancelled_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['status', 'purchased_at'])
      table.index(['supplier_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
