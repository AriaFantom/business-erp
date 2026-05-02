import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('actor_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('action').notNullable()
      table.string('target_type').nullable()
      table.integer('target_id').nullable()
      table.jsonb('payload').nullable()
      table.timestamp('occurred_at').notNullable()
      table.index(['target_type', 'target_id', 'occurred_at'])
      table.index(['action', 'occurred_at'])
      table.index(['actor_user_id', 'occurred_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
