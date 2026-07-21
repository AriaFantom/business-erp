import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'workers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('phone').nullable()
      table.text('notes').nullable()
      // 'hourly' | 'monthly' — how the worker is paid. Monthly workers still
      // cost jobs by the hour via monthly_salary / standard_monthly_hours.
      table.string('pay_type').notNullable().defaultTo('hourly')
      table.decimal('hourly_rate', 14, 2).notNullable().defaultTo(0)
      table.decimal('monthly_salary', 14, 2).notNullable().defaultTo(0)
      // Contracted hours in a month, the divisor for the derived hourly rate.
      table.integer('standard_monthly_hours').notNullable().defaultTo(208)
      // 'idle' | 'working' | 'inactive' — mirrors machines.status.
      table.string('status').notNullable().defaultTo('idle')
      table
        .integer('current_job_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('production_jobs')
        .onDelete('SET NULL')
      table.timestamp('joined_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.index(['status'])
    })
    this.schema.raw(
      `ALTER TABLE workers
       ADD CONSTRAINT workers_standard_monthly_hours_positive CHECK (standard_monthly_hours > 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
