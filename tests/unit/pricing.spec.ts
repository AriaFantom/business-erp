import { test } from '@japa/runner'
import { computeMinimumProfitTarget, computeUnitPrice } from '#services/pricing'

function makeProduct(overrides: Record<string, any> = {}): any {
  return {
    defaultProfitPct: '30',
    taxRatePct: '18',
    defaultSalePrice: null,
    ...overrides,
  }
}

test.group('computeUnitPrice — default sale price', () => {
  test('uses defaultSalePrice when set and no manualUnitPrice', ({ assert }) => {
    const result = computeUnitPrice({
      costPrice: 1000,
      product: makeProduct({ defaultSalePrice: '1499' }),
      category: null,
    })
    assert.equal(result.unitPrice, 1499)
    assert.equal(result.profitPctUsed, null)
    assert.equal(result.basis.profitFrom, 'product_default')
    assert.equal(result.costPrice, 1000)
  })

  test('manualUnitPrice wins over defaultSalePrice', ({ assert }) => {
    const result = computeUnitPrice({
      costPrice: 1000,
      manualUnitPrice: 2000,
      product: makeProduct({ defaultSalePrice: '1499' }),
      category: null,
    })
    assert.equal(result.unitPrice, 2000)
    assert.equal(result.basis.profitFrom, 'manual')
  })

  test('null defaultSalePrice falls through to profit ladder', ({ assert }) => {
    const result = computeUnitPrice({
      costPrice: 1000,
      product: makeProduct({ defaultSalePrice: null, defaultProfitPct: '30' }),
      category: null,
    })
    assert.equal(result.basis.profitFrom, 'product')
    assert.equal(result.profitPctUsed, 30)
  })
})

test.group('computeMinimumProfitTarget', () => {
  test('prefers an explicit category profit including zero', ({ assert }) => {
    const result = computeMinimumProfitTarget({
      costPrice: 100,
      product: makeProduct({ defaultProfitPct: '30' }),
      category: { defaultProfitPct: '0' } as any,
    })
    assert.deepEqual(result, { price: 100, profitPct: 0, profitFrom: 'category' })
  })

  test('rounds upward to the next cent without understating the target', ({ assert }) => {
    const result = computeMinimumProfitTarget({
      costPrice: 10.01,
      product: makeProduct({ defaultProfitPct: '25' }),
      category: null,
    })
    assert.equal(result.price, 12.52)
    assert.equal(result.profitFrom, 'product')
  })

  test('returns no price before a cost basis exists', ({ assert }) => {
    const result = computeMinimumProfitTarget({
      costPrice: null,
      product: makeProduct(),
      category: null,
    })
    assert.isNull(result.price)
  })
})
