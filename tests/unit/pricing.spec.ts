import { test } from '@japa/runner'
import { computeUnitPrice } from '#services/pricing'

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
