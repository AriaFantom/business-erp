import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_job_stages'

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
      table.integer('sequence').notNullable()
      table.string('name').notNullable()
      table.integer('estimated_duration_min').notNullable()
      // 'pending' | 'in_progress' | 'completed' | 'skipped'
      table.string('status').notNullable().defaultTo('pending')
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamp('auto_complete_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.unique(['job_id', 'sequence'])
      table.index(['job_id', 'status'])
    })
    this.schema.raw(
      `ALTER TABLE production_jobs
       ADD CONSTRAINT production_jobs_current_stage_fk
       FOREIGN KEY (current_stage_id)
       REFERENCES production_job_stages(id)
       ON DELETE SET NULL`
    )
  }

  async down() {
    this.schema.raw(
      `ALTER TABLE production_jobs DROP CONSTRAINT IF EXISTS production_jobs_current_stage_fk`
    )
    this.schema.dropTable(this.tableName)
  }
}
