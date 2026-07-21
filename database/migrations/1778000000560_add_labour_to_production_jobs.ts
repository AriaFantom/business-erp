import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('production_jobs', (table) => {
      // Summed worker minutes on the job, and their cost, folded into
      // total_cost at completion — the labour twin of machine_minutes /
      // total_machine_cost.
      // Hand-work jobs may run with workers and no machine at all; machine_id
      // is already nullable, so no change is needed there.
      table.integer('labour_minutes').notNullable().defaultTo(0)
      table.decimal('total_labour_cost', 14, 2).notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('production_jobs', (table) => {
      table.dropColumn('total_labour_cost')
      table.dropColumn('labour_minutes')
    })
  }
}
