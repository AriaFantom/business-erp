import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('machines', (table) => {
      // Cost of one machine-hour (depreciation + electricity + upkeep),
      // folded into job cost from actual stage run time.
      table.decimal('hourly_rate', 14, 2).notNullable().defaultTo(0)
    })

    this.schema.alterTable('production_jobs', (table) => {
      // Actual run minutes summed from stage started/completed timestamps.
      table.integer('machine_minutes').notNullable().defaultTo(0)
      table.decimal('total_machine_cost', 14, 2).notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('production_jobs', (table) => {
      table.dropColumn('total_machine_cost')
      table.dropColumn('machine_minutes')
    })
    this.schema.alterTable('machines', (table) => {
      table.dropColumn('hourly_rate')
    })
  }
}
