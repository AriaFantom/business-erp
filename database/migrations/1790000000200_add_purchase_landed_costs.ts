import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('purchases', (table) => {
      table.decimal('shipping_charge', 14, 2).notNullable().defaultTo(0)
      table.string('tax_entry_mode', 32).notNullable().defaultTo('legacy_line')
    })

    this.schema.alterTable('purchase_items', (table) => {
      table.decimal('allocated_shipping', 14, 2).notNullable().defaultTo(0)
      table.decimal('allocated_tax', 14, 2).notNullable().defaultTo(0)
      table.decimal('landed_unit_cost', 14, 4).nullable()
    })

    this.defer(async (db) => {
      await db.from('purchase_items').update({
        landed_unit_cost: db.raw('unit_cost'),
      })
    })
  }

  async down() {
    this.schema.alterTable('purchase_items', (table) => {
      table.dropColumn('landed_unit_cost')
      table.dropColumn('allocated_tax')
      table.dropColumn('allocated_shipping')
    })

    this.schema.alterTable('purchases', (table) => {
      table.dropColumn('tax_entry_mode')
      table.dropColumn('shipping_charge')
    })
  }
}
