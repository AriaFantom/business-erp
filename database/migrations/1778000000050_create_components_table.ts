import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'components'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('sku').notNullable().unique()
      table.string('name').notNullable()
      table.string('unit').notNullable().defaultTo('pcs')
      table
        .integer('default_supplier_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('SET NULL')
      table.decimal('default_unit_cost', 14, 4).notNullable().defaultTo(0)
      table.integer('reorder_threshold_qty').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamps(true, true)
      table.index(['is_active'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
