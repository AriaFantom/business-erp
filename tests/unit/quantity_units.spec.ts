import { test } from '@japa/runner'
import { compatibleConsumptionUnits, convertConsumptionQuantity } from '#services/quantity_units'
import { DomainError } from '#services/domain_errors'

test.group('consumption quantity units', () => {
  test('converts mass, volume, and length in both directions', ({ assert }) => {
    assert.equal(convertConsumptionQuantity(500, 'g', 'kg').storedQuantity, '0.5')
    assert.equal(convertConsumptionQuantity(1.25, 'kg', 'g').storedQuantity, '1250')
    assert.equal(convertConsumptionQuantity(250, 'ml', 'l').storedQuantity, '0.25')
    assert.equal(convertConsumptionQuantity(1.5, 'l', 'ml').storedQuantity, '1500')
    assert.equal(convertConsumptionQuantity(25, 'cm', 'm').storedQuantity, '0.25')
    assert.equal(convertConsumptionQuantity(2, 'm', 'mm').storedQuantity, '2000')
  })

  test('preserves nine-decimal converted quantities', ({ assert }) => {
    assert.equal(convertConsumptionQuantity(0.001, 'mg', 'kg').storedQuantity, '0.000000001')
  })

  test('keeps pieces and custom units exact', ({ assert }) => {
    assert.deepEqual(compatibleConsumptionUnits('pieces'), ['pieces'])
    assert.equal(convertConsumptionQuantity(3, 'pieces', 'pieces').storedQuantity, '3')
    assert.deepEqual(compatibleConsumptionUnits('roll'), ['roll'])
    assert.equal(convertConsumptionQuantity(2.5, 'roll', 'roll').storedQuantity, '2.5')
  })

  test('rejects incompatible and over-precise conversions', async ({ assert }) => {
    assert.throws(() => convertConsumptionQuantity(1, 'l', 'kg'), DomainError)
    assert.throws(() => convertConsumptionQuantity(0.0001, 'mg', 'kg'), DomainError)
  })
})
