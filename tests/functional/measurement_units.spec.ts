import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Component from '#models/component'
import {
  createMeasurementUnit,
  getMeasurementUnits,
  normalizeOutputCount,
  updateMeasurementUnit,
} from '#services/measurement_registry'

test.group('Measurement registry', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('locks custom factors when first used by a catalog item', async ({ assert }) => {
    const actor = await User.create({
      email: 'measurement-owner@example.test',
      password: 'Passw0rd!',
      firstName: 'Measurement',
      lastName: 'Owner',
      isOwner: true,
    })
    const seeded = await getMeasurementUnits()
    const pieces = seeded.find((unit) => unit.code === 'pcs')!
    await createMeasurementUnit(actor, {
      name: 'Pack of six',
      code: 'pack6',
      factor: '6',
      categoryId: pieces.categoryId,
    })
    const configured = await getMeasurementUnits()
    const custom = configured.find((unit) => unit.code === 'pack6')!
    await updateMeasurementUnit(actor, custom.id, {
      name: 'Pack of six',
      active: true,
      factor: '6',
    })
    await Component.create({
      sku: 'MEASURE-PACK',
      name: 'Test pack',
      unit: 'pack6',
      defaultUnitCost: '0',
      isActive: true,
    })
    const afterUse = await getMeasurementUnits()
    assert.isTrue(afterUse.find((unit) => unit.id === custom.id)?.locked)
    await assert.rejects(
      () =>
        updateMeasurementUnit(actor, custom.id, { name: custom.name, active: true, factor: '7' }),
      /locked/
    )
  })

  test('accepts half a dozen and rejects fractional pieces or other categories', async ({
    assert,
  }) => {
    const result = await db.transaction((trx) => normalizeOutputCount(trx, 0.5, 'dozen'))
    assert.equal(result.pieces, 6)
    assert.equal(result.snapshot.enteredUnit, 'dozen')
    await assert.rejects(
      () => db.transaction((trx) => normalizeOutputCount(trx, 0.1, 'dozen')),
      /whole pieces/
    )
    await assert.rejects(
      () => db.transaction((trx) => normalizeOutputCount(trx, 1, 'kg')),
      /not compatible/
    )
  })
})
