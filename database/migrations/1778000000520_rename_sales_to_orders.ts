import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.renameTable('sales', 'orders')
    this.schema.renameTable('sale_items', 'order_items')
    this.schema.renameTable('sale_returns', 'order_returns')
    this.schema.renameTable('sale_return_items', 'order_return_items')

    this.schema.alterTable('order_items', (table) => {
      table.renameColumn('sale_id', 'order_id')
    })
    this.schema.alterTable('invoices', (table) => {
      table.renameColumn('sale_id', 'order_id')
    })
    this.schema.alterTable('quotations', (table) => {
      table.renameColumn('converted_to_sale_id', 'converted_to_order_id')
    })
    this.schema.alterTable('order_returns', (table) => {
      table.renameColumn('sale_id', 'order_id')
    })
    this.schema.alterTable('order_return_items', (table) => {
      table.renameColumn('sale_return_id', 'order_return_id')
      table.renameColumn('sale_item_id', 'order_item_id')
    })

    this.schema.raw(
      `ALTER INDEX sales_status_created_at_index RENAME TO orders_status_created_at_index`
    )
    this.schema.raw(`ALTER INDEX sales_customer_id_index RENAME TO orders_customer_id_index`)
    this.schema.raw(`ALTER INDEX sale_items_sale_id_index RENAME TO order_items_order_id_index`)
    this.schema.raw(`ALTER INDEX sale_returns_sale_id_index RENAME TO order_returns_order_id_index`)
    this.schema.raw(
      `ALTER INDEX sale_returns_invoice_id_index RENAME TO order_returns_invoice_id_index`
    )
    this.schema.raw(
      `ALTER INDEX sale_returns_customer_id_index RENAME TO order_returns_customer_id_index`
    )
    this.schema.raw(
      `ALTER INDEX sale_return_items_sale_return_id_index RENAME TO order_return_items_order_return_id_index`
    )
    this.schema.raw(
      `ALTER INDEX sale_return_items_sale_item_id_index RENAME TO order_return_items_order_item_id_index`
    )

    this.schema.raw(
      `ALTER TABLE orders RENAME CONSTRAINT sales_number_unique TO orders_number_unique`
    )
    this.schema.raw(
      `ALTER TABLE order_returns RENAME CONSTRAINT sale_returns_number_unique TO order_returns_number_unique`
    )
    this.schema.raw(
      `ALTER TABLE order_return_items RENAME CONSTRAINT sale_return_items_qty_positive TO order_return_items_qty_positive`
    )
    this.schema.raw(
      `ALTER TABLE invoices RENAME CONSTRAINT invoices_sale_id_unique TO invoices_order_id_unique`
    )

    // Stored strings: stock movement reason / reference_type.
    this.schema.raw(`UPDATE stock_movements SET reason = 'order' WHERE reason = 'sale'`)
    this.schema.raw(
      `UPDATE stock_movements SET reason = 'order_return' WHERE reason = 'sale_return'`
    )
    this.schema.raw(
      `UPDATE stock_movements SET reference_type = 'order' WHERE reference_type = 'sale'`
    )
    this.schema.raw(
      `UPDATE stock_movements SET reference_type = 'order_return' WHERE reference_type = 'sale_return'`
    )

    // Stored strings: audit events.
    this.schema.raw(`UPDATE audit_events SET target_type = 'order' WHERE target_type = 'sale'`)
    this.schema.raw(
      `UPDATE audit_events SET action = 'order.' || substring(action FROM 6) WHERE action LIKE 'sale.%'`
    )
    this.schema.raw(
      `UPDATE audit_events SET action = 'inventory.order' WHERE action = 'inventory.sale'`
    )
    this.schema.raw(
      `UPDATE audit_events SET action = 'inventory.order_return' WHERE action = 'inventory.sale_return'`
    )

    // Stored strings: role permission keys (JSON-encoded text column).
    this.schema.raw(
      `UPDATE roles SET permissions = replace(permissions, '"sales.', '"orders.') WHERE permissions LIKE '%"sales.%'`
    )
    this.schema.raw(
      `UPDATE roles SET permissions = replace(permissions, '"quotations.convertToSale"', '"quotations.convertToOrder"') WHERE permissions LIKE '%quotations.convertToSale%'`
    )

    // Doc numbering scope: 'SO' -> 'ORD' (prefix changes to ORD-, counter carries over).
    this.schema.raw(`UPDATE doc_sequences SET scope = 'ORD' WHERE scope = 'SO'`)
  }

  async down() {
    this.schema.raw(`UPDATE doc_sequences SET scope = 'SO' WHERE scope = 'ORD'`)

    this.schema.raw(
      `UPDATE roles SET permissions = replace(permissions, '"quotations.convertToOrder"', '"quotations.convertToSale"') WHERE permissions LIKE '%quotations.convertToOrder%'`
    )
    this.schema.raw(
      `UPDATE roles SET permissions = replace(permissions, '"orders.', '"sales.') WHERE permissions LIKE '%"orders.%'`
    )

    this.schema.raw(
      `UPDATE audit_events SET action = 'inventory.sale_return' WHERE action = 'inventory.order_return'`
    )
    this.schema.raw(
      `UPDATE audit_events SET action = 'inventory.sale' WHERE action = 'inventory.order'`
    )
    this.schema.raw(
      `UPDATE audit_events SET action = 'sale.' || substring(action FROM 7) WHERE action LIKE 'order.%'`
    )
    this.schema.raw(`UPDATE audit_events SET target_type = 'sale' WHERE target_type = 'order'`)

    this.schema.raw(
      `UPDATE stock_movements SET reference_type = 'sale_return' WHERE reference_type = 'order_return'`
    )
    this.schema.raw(
      `UPDATE stock_movements SET reference_type = 'sale' WHERE reference_type = 'order'`
    )
    this.schema.raw(
      `UPDATE stock_movements SET reason = 'sale_return' WHERE reason = 'order_return'`
    )
    this.schema.raw(`UPDATE stock_movements SET reason = 'sale' WHERE reason = 'order'`)

    this.schema.raw(
      `ALTER TABLE invoices RENAME CONSTRAINT invoices_order_id_unique TO invoices_sale_id_unique`
    )
    this.schema.raw(
      `ALTER TABLE order_return_items RENAME CONSTRAINT order_return_items_qty_positive TO sale_return_items_qty_positive`
    )
    this.schema.raw(
      `ALTER TABLE order_returns RENAME CONSTRAINT order_returns_number_unique TO sale_returns_number_unique`
    )
    this.schema.raw(
      `ALTER TABLE orders RENAME CONSTRAINT orders_number_unique TO sales_number_unique`
    )

    this.schema.raw(
      `ALTER INDEX order_return_items_order_item_id_index RENAME TO sale_return_items_sale_item_id_index`
    )
    this.schema.raw(
      `ALTER INDEX order_return_items_order_return_id_index RENAME TO sale_return_items_sale_return_id_index`
    )
    this.schema.raw(
      `ALTER INDEX order_returns_customer_id_index RENAME TO sale_returns_customer_id_index`
    )
    this.schema.raw(
      `ALTER INDEX order_returns_invoice_id_index RENAME TO sale_returns_invoice_id_index`
    )
    this.schema.raw(`ALTER INDEX order_returns_order_id_index RENAME TO sale_returns_sale_id_index`)
    this.schema.raw(`ALTER INDEX order_items_order_id_index RENAME TO sale_items_sale_id_index`)
    this.schema.raw(`ALTER INDEX orders_customer_id_index RENAME TO sales_customer_id_index`)
    this.schema.raw(
      `ALTER INDEX orders_status_created_at_index RENAME TO sales_status_created_at_index`
    )

    this.schema.alterTable('order_return_items', (table) => {
      table.renameColumn('order_return_id', 'sale_return_id')
      table.renameColumn('order_item_id', 'sale_item_id')
    })
    this.schema.alterTable('order_returns', (table) => {
      table.renameColumn('order_id', 'sale_id')
    })
    this.schema.alterTable('quotations', (table) => {
      table.renameColumn('converted_to_order_id', 'converted_to_sale_id')
    })
    this.schema.alterTable('invoices', (table) => {
      table.renameColumn('order_id', 'sale_id')
    })
    this.schema.alterTable('order_items', (table) => {
      table.renameColumn('order_id', 'sale_id')
    })

    this.schema.renameTable('order_return_items', 'sale_return_items')
    this.schema.renameTable('order_returns', 'sale_returns')
    this.schema.renameTable('order_items', 'sale_items')
    this.schema.renameTable('orders', 'sales')
  }
}
