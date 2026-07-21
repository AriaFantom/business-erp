import { test } from '@japa/runner'
import {
  PRESETS,
  resolveCascade,
  resolveEnable,
  validateSelection,
  type ModuleKey,
} from '#services/modules/registry'

test.group('module registry: validateSelection', () => {
  test('a full selection has no violations', ({ assert }) => {
    const all: ModuleKey[] = [
      'inventory',
      'purchase',
      'manufacturing',
      'machines',
      'orders',
      'invoices',
      'quotations',
      'pos',
      'reports',
    ]
    assert.lengthOf(validateSelection(all), 0)
  })

  test('orders without inventory or invoices reports missing dependencies', ({ assert }) => {
    const violations = validateSelection(['orders'])
    assert.lengthOf(violations, 1)
    assert.equal(violations[0].module, 'orders')
    assert.deepEqual(violations[0].missing.sort(), ['inventory', 'invoices'])
  })

  test('machines without manufacturing is invalid', ({ assert }) => {
    const violations = validateSelection(['machines'])
    assert.deepEqual(violations[0], { module: 'machines', missing: ['manufacturing'] })
  })

  test('inventory alone is valid (it is the spine, depends on nothing)', ({ assert }) => {
    assert.lengthOf(validateSelection(['inventory']), 0)
  })
})

test.group('module registry: resolveCascade', () => {
  test('disabling inventory cascades to everything that needs it', ({ assert }) => {
    // Start from "everything except inventory" — all dependents must drop out.
    const result = resolveCascade([
      'purchase',
      'manufacturing',
      'machines',
      'orders',
      'invoices',
      'quotations',
      'pos',
      'reports',
    ])
    // Only modules with no unmet deps survive: invoices and reports.
    assert.deepEqual(result.sort(), ['invoices', 'reports'])
  })

  test('disabling orders cascades to its dependents (quotations, pos)', ({ assert }) => {
    const result = resolveCascade(['inventory', 'invoices', 'quotations', 'pos'])
    assert.notInclude(result, 'quotations')
    assert.notInclude(result, 'pos')
    assert.deepEqual(result.sort(), ['inventory', 'invoices'])
  })
})

test.group('module registry: resolveEnable', () => {
  test('enabling orders pulls in inventory and invoices', ({ assert }) => {
    const result = resolveEnable(['orders'])
    assert.includeMembers(result, ['orders', 'inventory', 'invoices'])
  })

  test('enabling pos pulls in the full orders chain', ({ assert }) => {
    const result = resolveEnable(['pos'])
    assert.includeMembers(result, ['pos', 'orders', 'inventory', 'invoices'])
  })
})

test.group('module registry: presets', () => {
  test('every preset is internally consistent once dependencies are resolved', ({ assert }) => {
    for (const preset of PRESETS) {
      const resolved = resolveEnable(preset.modules)
      assert.lengthOf(
        validateSelection(resolved),
        0,
        `preset "${preset.key}" should resolve to a valid selection`
      )
    }
  })

  test('retail preset excludes purchase and manufacturing', ({ assert }) => {
    const retail = PRESETS.find((p) => p.key === 'retail')!
    const resolved = resolveEnable(retail.modules)
    assert.notInclude(resolved, 'purchase')
    assert.notInclude(resolved, 'manufacturing')
    assert.includeMembers(resolved, ['inventory', 'orders'])
  })
})
