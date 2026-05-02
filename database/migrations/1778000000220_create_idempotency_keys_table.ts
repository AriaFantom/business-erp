import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'idempotency_keys'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('actor_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('route').notNullable()
      table.string('key').notNullable()
      table.integer('response_status').notNullable()
      table.jsonb('response_body').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('expires_at').notNullable()
      table.unique(['actor_user_id', 'route', 'key'])
      table.index(['expires_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
