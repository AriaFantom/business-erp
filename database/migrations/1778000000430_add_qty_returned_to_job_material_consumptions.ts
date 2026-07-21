import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'job_material_consumptions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Quantity handed back to stock when a job fails/cancels. line_cost is
      // recomputed as unit_cost_at_consume * (qty_consumed - qty_returned) so
      // a failed job only carries the cost of what was actually lost.
      table.decimal('qty_returned', 14, 3).notNullable().defaultTo(0)
    })
    this.schema.raw(
      `ALTER TABLE job_material_consumptions
       ADD CONSTRAINT job_consumptions_returned_within_consumed
       CHECK (qty_returned >= 0 AND qty_returned <= qty_consumed)`
    )
  }

  async down() {
    this.schema.raw(
      `ALTER TABLE job_material_consumptions DROP CONSTRAINT IF EXISTS job_consumptions_returned_within_consumed`
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('qty_returned')
    })
  }
}
