import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('measurement_categories', (table) => {
      table.increments('id')
      table.string('name', 80).notNullable()
    })
    this.schema.createTable('measurement_units', (table) => {
      table.increments('id')
      table
        .integer('category_id')
        .notNullable()
        .references('measurement_categories.id')
        .onDelete('RESTRICT')
      table.string('code', 16).notNullable().unique()
      table.string('name', 80).notNullable()
      table.decimal('factor', 24, 12).notNullable()
      table.boolean('is_reference').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.boolean('is_locked').notNullable().defaultTo(false)
    })
    for (const tableName of ['materials', 'components']) {
      this.schema.alterTable(tableName, (table) => {
        table.integer('measurement_unit_id').references('measurement_units.id').onDelete('RESTRICT')
      })
    }
    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX measurement_categories_name_unique ON measurement_categories (lower(name));
        CREATE UNIQUE INDEX measurement_units_reference_unique ON measurement_units (category_id) WHERE is_reference;
        ALTER TABLE measurement_units ADD CHECK (factor > 0 AND factor <> 'NaN'::numeric);
        ALTER TABLE measurement_units ADD CHECK (NOT is_reference OR (factor = 1 AND is_active AND is_locked));
      `)
      const groups = [
        [
          'Weight',
          [
            ['g', 'Gram', '1'],
            ['mg', 'Milligram', '0.001'],
            ['kg', 'Kilogram', '1000'],
          ],
        ],
        [
          'Volume',
          [
            ['l', 'Litre', '1'],
            ['ml', 'Millilitre', '0.001'],
          ],
        ],
        [
          'Length',
          [
            ['m', 'Metre', '1'],
            ['cm', 'Centimetre', '0.01'],
            ['mm', 'Millimetre', '0.001'],
          ],
        ],
        [
          'Count',
          [
            ['pcs', 'Piece', '1'],
            ['dozen', 'Dozen', '12'],
          ],
        ],
      ] as const
      for (const [name, entries] of groups) {
        const [{ id }] = await db.table('measurement_categories').insert({ name }).returning('id')
        await db.table('measurement_units').insert(
          entries.map(([code, label, factor], index) => ({
            category_id: id,
            code,
            name: label,
            factor,
            is_reference: index === 0,
            is_locked: true,
          }))
        )
      }
      // An existing unregistered symbol must not silently acquire new conversion rules.
      const { rows } = await db.rawQuery(`
        SELECT DISTINCT lower(btrim(unit)) AS code
        FROM (SELECT unit FROM materials UNION ALL SELECT unit FROM components) AS catalog
        WHERE btrim(unit) <> '' AND NOT EXISTS (
          SELECT 1 FROM measurement_units WHERE code = lower(btrim(catalog.unit))
        )
      `)
      for (const { code } of rows as { code: string }[]) {
        const [{ id }] = await db
          .table('measurement_categories')
          .insert({ name: `Legacy: ${code}` })
          .returning('id')
        await db.table('measurement_units').insert({
          category_id: id,
          code,
          name: code,
          factor: 1,
          is_reference: true,
          is_locked: true,
        })
      }
      // Existing code strings remain untouched; link them to the registry.
      for (const [table, column] of [
        ['materials', 'material_id'],
        ['components', 'component_id'],
      ]) {
        await db.rawQuery(`
          UPDATE ${table} AS catalog SET measurement_unit_id = unit.id
          FROM measurement_units AS unit WHERE unit.code = lower(btrim(catalog.unit));
          CREATE FUNCTION link_${table}_measurement_unit() RETURNS trigger LANGUAGE plpgsql AS $$
          DECLARE selected measurement_units%ROWTYPE;
          BEGIN
            IF TG_OP = 'UPDATE' THEN
              IF NEW.unit = OLD.unit THEN
                NEW.measurement_unit_id := OLD.measurement_unit_id;
                RETURN NEW;
              END IF;
              IF EXISTS (SELECT 1 FROM inventory WHERE ${column} = OLD.id AND qty <> 0)
                OR EXISTS (SELECT 1 FROM stock_movements WHERE ${column} = OLD.id)
                OR EXISTS (SELECT 1 FROM purchase_items WHERE ${column} = OLD.id)
                OR EXISTS (SELECT 1 FROM purchase_return_items WHERE ${column} = OLD.id)
                OR EXISTS (SELECT 1 FROM quotation_item_boms WHERE ${column} = OLD.id)
                OR EXISTS (SELECT 1 FROM job_material_consumptions WHERE ${column} = OLD.id)
                OR EXISTS (SELECT 1 FROM product_recipes WHERE ${column} = OLD.id)
                OR EXISTS (SELECT 1 FROM stock_take_items WHERE ${column} = OLD.id) THEN
                RAISE EXCEPTION 'Stored unit cannot change after business use' USING ERRCODE = '23514';
              END IF;
            END IF;
            PERFORM pg_advisory_xact_lock_shared(41750, 1);
            SELECT * INTO selected FROM measurement_units WHERE code = lower(btrim(NEW.unit));
            IF NOT FOUND OR NOT selected.is_active THEN
              RAISE EXCEPTION 'Choose an active unit from Settings' USING ERRCODE = '23514';
            END IF;
            NEW.measurement_unit_id := selected.id;
            UPDATE measurement_units SET is_locked = true WHERE id = selected.id AND NOT is_locked;
            RETURN NEW;
          END;
          $$;
          CREATE TRIGGER ${table}_measurement_unit BEFORE INSERT OR UPDATE OF unit, measurement_unit_id ON ${table}
          FOR EACH ROW EXECUTE FUNCTION link_${table}_measurement_unit();
        `)
      }
    })
    this.schema.alterTable('quotation_item_boms', (table) => {
      table.decimal('qty', 19, 9).notNullable().alter()
    })
  }

  async down() {
    throw new Error('Do not roll back measurement units or shrink saved quantity precision.')
  }
}
