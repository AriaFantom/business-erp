import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_attachments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('kind', 16).notNullable().defaultTo('file')
      table.integer('sort_order').notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(
        "UPDATE product_attachments SET kind = 'image' WHERE mime_type LIKE 'image/%'"
      )
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['product_id', 'kind', 'sort_order'], 'product_attachments_gallery_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['product_id', 'kind', 'sort_order'], 'product_attachments_gallery_idx')
      table.dropColumn('kind')
      table.dropColumn('sort_order')
    })
  }
}
