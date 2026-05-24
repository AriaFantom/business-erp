import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('default_sale_price', 12, 2).nullable()
      table
        .integer('default_sale_price_source_job_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('production_jobs')
        .onDelete('SET NULL')
      table.timestamp('default_sale_price_set_at', { useTz: true }).nullable()
      table
        .integer('default_sale_price_set_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('default_sale_price')
      table.dropColumn('default_sale_price_source_job_id')
      table.dropColumn('default_sale_price_set_at')
      table.dropColumn('default_sale_price_set_by_user_id')
    })
  }
}
