import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quotation_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('pricing_basis', 20).nullable()
      table.decimal('estimated_material_cost', 14, 4).nullable()
      table.decimal('estimated_component_cost', 14, 4).nullable()
      table.decimal('estimated_extra_cost', 14, 4).nullable()
      table.decimal('estimated_unit_cost', 14, 4).nullable()
      table.decimal('estimated_profit_pct', 7, 2).nullable()
      table.decimal('estimated_suggested_unit_price', 14, 2).nullable()
      table.string('estimate_cost_fingerprint', 64).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns(
        'pricing_basis',
        'estimated_material_cost',
        'estimated_component_cost',
        'estimated_extra_cost',
        'estimated_unit_cost',
        'estimated_profit_pct',
        'estimated_suggested_unit_price',
        'estimate_cost_fingerprint'
      )
    })
  }
}
