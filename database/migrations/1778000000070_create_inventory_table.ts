import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'inventory'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Polymorphic: 'material' | 'component'
      table.string('item_kind').notNullable()
      table.integer('item_id').unsigned().notNullable()
      table.decimal('qty', 14, 3).notNullable().defaultTo(0)
      table.decimal('avg_unit_cost', 14, 4).notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.unique(['item_kind', 'item_id'])
    })
    // Negative-stock guard at the DB layer
    this.schema.raw(`ALTER TABLE inventory ADD CONSTRAINT inventory_qty_nonneg CHECK (qty >= 0)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
