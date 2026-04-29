import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'resource_grants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('resource_type').notNullable()
      table.string('resource_id').notNullable()
      table.text('actions').notNullable().defaultTo('[]')
      table
        .integer('granted_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('expires_at').nullable()
      table.timestamps(true, true)
      table.index(['user_id', 'resource_type', 'resource_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
