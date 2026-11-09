import { BaseSchema } from '@adonisjs/lucid/schema'

const POLYMORPHIC_TABLES = [
  'inventory',
  'stock_movements',
  'purchase_items',
  'purchase_return_items',
  'job_material_consumptions',
  'product_recipes',
  'quotation_item_boms',
  'stock_take_items',
]

export default class extends BaseSchema {
  async up() {
    for (const tableName of POLYMORPHIC_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.integer('material_id').unsigned().nullable()
        table.integer('component_id').unsigned().nullable()
        table.integer('catalog_product_id').unsigned().nullable()
      })
    }

    this.schema.raw(`
      CREATE OR REPLACE FUNCTION sync_typed_catalog_references()
      RETURNS trigger AS $$
      BEGIN
        NEW.material_id := CASE WHEN NEW.item_kind = 'material' THEN NEW.item_id ELSE NULL END;
        NEW.component_id := CASE WHEN NEW.item_kind = 'component' THEN NEW.item_id ELSE NULL END;
        NEW.catalog_product_id := CASE WHEN NEW.item_kind = 'product' THEN NEW.item_id ELSE NULL END;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)

    for (const tableName of POLYMORPHIC_TABLES) {
      this.schema.raw(`
        CREATE TRIGGER ${tableName}_sync_catalog_refs
        BEFORE INSERT OR UPDATE OF item_kind, item_id ON ${tableName}
        FOR EACH ROW EXECUTE FUNCTION sync_typed_catalog_references()
      `)
      this.schema.raw(`UPDATE ${tableName} SET item_id = item_id`)
      this.schema.raw(`
        ALTER TABLE ${tableName}
          ADD CONSTRAINT ${tableName}_material_id_foreign
            FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT,
          ADD CONSTRAINT ${tableName}_component_id_foreign
            FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE RESTRICT,
          ADD CONSTRAINT ${tableName}_catalog_product_id_foreign
            FOREIGN KEY (catalog_product_id) REFERENCES products(id) ON DELETE RESTRICT,
          ADD CONSTRAINT ${tableName}_typed_catalog_reference_check CHECK (
            (item_kind = 'material' AND material_id = item_id AND component_id IS NULL AND catalog_product_id IS NULL)
            OR (item_kind = 'component' AND component_id = item_id AND material_id IS NULL AND catalog_product_id IS NULL)
            OR (item_kind = 'product' AND catalog_product_id = item_id AND material_id IS NULL AND component_id IS NULL)
            OR (item_kind NOT IN ('material', 'component', 'product') AND material_id IS NULL AND component_id IS NULL AND catalog_product_id IS NULL)
          )
      `)
    }

    this.schema.alterTable('purchase_items', (table) => {
      table.string('machine_name', 120).nullable()
      table.string('machine_model', 120).nullable()
    })
    this.schema.raw(`
      ALTER TABLE purchase_items
      ADD CONSTRAINT purchase_items_machine_qty_check
      CHECK (item_kind <> 'machine' OR (qty = floor(qty) AND qty >= 1))
    `)

    this.schema.createTable('production_outputs', (table) => {
      table.increments('id')
      table
        .integer('job_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('production_jobs')
        .onDelete('RESTRICT')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')
      table
        .integer('machine_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('machines')
        .onDelete('RESTRICT')
      table.integer('produced_qty').unsigned().notNullable()
      table.integer('available_qty').unsigned().notNullable()
      table.decimal('unit_cost', 14, 4).notNullable()
      table.timestamp('produced_at', { useTz: true }).notNullable()
      table.timestamps(true, true)
      table.index(['product_id', 'produced_at', 'id'])
      table.index(['machine_id'])
    })
    this.schema.raw(`
      ALTER TABLE production_outputs
      ADD CONSTRAINT production_outputs_qty_check
      CHECK (produced_qty > 0 AND available_qty >= 0 AND available_qty <= produced_qty)
    `)

    this.schema.createTable('order_item_production_allocations', (table) => {
      table.increments('id')
      table
        .integer('order_item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('order_items')
        .onDelete('RESTRICT')
      table
        .integer('production_output_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('production_outputs')
        .onDelete('RESTRICT')
      table.integer('qty').unsigned().notNullable()
      table.integer('returned_qty').unsigned().notNullable().defaultTo(0)
      table.decimal('unit_sale_price', 14, 4).notNullable()
      table.decimal('unit_cost', 14, 4).notNullable()
      table.timestamps(true, true)
      table.index(['order_item_id'])
      table.index(['production_output_id'])
    })
    this.schema.raw(`
      ALTER TABLE order_item_production_allocations
      ADD CONSTRAINT order_item_production_allocations_qty_check
      CHECK (qty > 0 AND returned_qty >= 0 AND returned_qty <= qty)
    `)

    this.schema.raw(`
      DO $$
      DECLARE target record;
      DECLARE constraint_name text;
      BEGIN
        FOR target IN
          SELECT * FROM (VALUES
            ('quotation_items', 'product_id'),
            ('order_items', 'product_id'),
            ('invoice_items', 'product_id'),
            ('order_return_items', 'product_id')
          ) AS targets(table_name, column_name)
        LOOP
          SELECT conname INTO constraint_name
          FROM pg_constraint
          WHERE conrelid = target.table_name::regclass
            AND contype = 'f'
            AND conkey = ARRAY[(SELECT attnum::smallint FROM pg_attribute
              WHERE attrelid = target.table_name::regclass AND attname = target.column_name)];
          IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target.table_name, constraint_name);
          END IF;
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES products(id) ON DELETE RESTRICT',
            target.table_name,
            target.table_name || '_product_id_restrict_foreign',
            target.column_name
          );
        END LOOP;
      END $$
    `)

    this.schema.raw(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'machines'::regclass
          AND contype = 'f'
          AND conkey = ARRAY[(SELECT attnum::smallint FROM pg_attribute WHERE attrelid = 'machines'::regclass AND attname = 'purchase_item_id')];
        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE machines DROP CONSTRAINT %I', constraint_name);
        END IF;
        ALTER TABLE machines
          ADD CONSTRAINT machines_purchase_item_id_restrict_foreign
          FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE RESTRICT;
      END $$
    `)
  }

  async down() {
    this.schema.raw(
      `ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_purchase_item_id_restrict_foreign`
    )
    this.schema.raw(`
      ALTER TABLE machines ADD CONSTRAINT machines_purchase_item_id_foreign
      FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE SET NULL
    `)

    for (const tableName of [
      'quotation_items',
      'order_items',
      'invoice_items',
      'order_return_items',
    ]) {
      this.schema.raw(
        `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_product_id_restrict_foreign`
      )
      this.schema.raw(`
        ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_product_id_foreign
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      `)
    }

    this.schema.dropTable('order_item_production_allocations')
    this.schema.dropTable('production_outputs')
    this.schema.raw(
      `ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_machine_qty_check`
    )
    this.schema.alterTable('purchase_items', (table) => {
      table.dropColumns('machine_name', 'machine_model')
    })

    for (const tableName of POLYMORPHIC_TABLES) {
      this.schema.raw(`DROP TRIGGER IF EXISTS ${tableName}_sync_catalog_refs ON ${tableName}`)
      this.schema.alterTable(tableName, (table) => {
        table.dropColumns('material_id', 'component_id', 'catalog_product_id')
      })
    }
    this.schema.raw(`DROP FUNCTION IF EXISTS sync_typed_catalog_references()`)
  }
}
