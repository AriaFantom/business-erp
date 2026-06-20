import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quotation_item_boms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('quotation_item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('quotation_items')
        .onDelete('CASCADE')
      table.enum('item_kind', ['material', 'component']).notNullable()
      table.integer('item_id').unsigned().notNullable()
      table.decimal('qty', 14, 4).notNullable()
      table.decimal('unit_cost_at_time', 14, 4).notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.index(['quotation_item_id'])
      table.index(['item_kind', 'item_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
