import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'job_expenses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('job_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('production_jobs')
        .onDelete('CASCADE')
      // 'electricity' | 'labor' | 'overhead' | 'other'
      table.string('kind').notNullable()
      table.string('description').notNullable()
      table.decimal('amount', 14, 2).notNullable()
      table.timestamp('incurred_at').notNullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['job_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
