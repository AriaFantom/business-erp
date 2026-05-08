import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_attachments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.string('file_key', 500).notNullable()
      table.string('original_name', 255).notNullable()
      table.bigInteger('size_bytes').notNullable().defaultTo(0)
      table.string('mime_type', 120).nullable()
      table
        .integer('uploaded_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['product_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
