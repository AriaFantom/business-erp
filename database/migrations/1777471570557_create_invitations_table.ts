import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invitations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('email').nullable()
      table.string('token', 128).notNullable().unique().index()
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('roles')
        .onDelete('RESTRICT')
      table
        .integer('invited_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.enum('type', ['setup', 'invite']).notNullable().defaultTo('invite')
      table
        .enum('status', ['pending', 'accepted', 'expired', 'revoked'])
        .notNullable()
        .defaultTo('pending')
      table.timestamp('expires_at').notNullable()
      table.timestamp('accepted_at').nullable()
      table.timestamps(true, true)
      table.index(['email', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
