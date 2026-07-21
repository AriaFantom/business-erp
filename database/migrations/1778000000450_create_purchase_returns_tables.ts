import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('purchase_returns', (table) => {
      table.increments('id')
      table.string('number').notNullable().unique()
      table
        .integer('purchase_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('purchases')
        .onDelete('RESTRICT')
      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('RESTRICT')
      // Supplier credit value of the returned goods (at purchase unit cost).
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
      table.index(['purchase_id'])
    })

    this.schema.createTable('purchase_return_items', (table) => {
      table.increments('id')
      table
        .integer('purchase_return_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('purchase_returns')
        .onDelete('CASCADE')
      table
        .integer('purchase_item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('purchase_items')
        .onDelete('RESTRICT')
      // 'material' | 'component'
      table.string('item_kind').notNullable()
      table.integer('item_id').unsigned().notNullable()
      table.decimal('qty', 14, 3).notNullable()
      // Credit per unit = the original purchase unit cost.
      table.decimal('unit_cost', 14, 4).notNullable().defaultTo(0)
      table.decimal('line_total', 14, 2).notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.index(['purchase_return_id'])
      table.index(['purchase_item_id'])
    })
    this.schema.raw(
      `ALTER TABLE purchase_return_items
       ADD CONSTRAINT purchase_return_items_qty_positive CHECK (qty > 0)`
    )
  }

  async down() {
    this.schema.dropTable('purchase_return_items')
    this.schema.dropTable('purchase_returns')
  }
}
