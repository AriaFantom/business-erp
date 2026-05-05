import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { updateUserRolesValidator } from '#validators/users'

type ValidationMessage = { field?: string; rule?: string }

async function expectValidationFailure(fn: () => Promise<unknown>): Promise<ValidationMessage[]> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof errors.E_VALIDATION_ERROR) {
      return err.messages as ValidationMessage[]
    }
    throw err
  }
  throw new Error('expected validator to throw E_VALIDATION_ERROR')
}

test.group('updateUserRolesValidator', () => {
  test('accepts a single positive role id', async ({ assert }) => {
    const out = await updateUserRolesValidator.validate({ roleIds: [3] })
    assert.deepEqual(out.roleIds, [3])
  })

  test('accepts up to 20 distinct positive role ids', async ({ assert }) => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1)
    const out = await updateUserRolesValidator.validate({ roleIds: ids })
    assert.equal(out.roleIds.length, 20)
  })

  test('rejects an empty role list (would orphan the user)', async () => {
    await expectValidationFailure(() => updateUserRolesValidator.validate({ roleIds: [] }))
  })

  test('rejects duplicate role ids', async () => {
    await expectValidationFailure(() => updateUserRolesValidator.validate({ roleIds: [1, 1] }))
  })

  test('rejects non-positive role ids', async () => {
    await expectValidationFailure(() => updateUserRolesValidator.validate({ roleIds: [0] }))
    await expectValidationFailure(() => updateUserRolesValidator.validate({ roleIds: [-3] }))
  })

  test('rejects more than 20 role ids', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => i + 1)
    await expectValidationFailure(() => updateUserRolesValidator.validate({ roleIds: ids }))
  })

  test('rejects non-numeric ids', async () => {
    await expectValidationFailure(() =>
      updateUserRolesValidator.validate({ roleIds: ['a' as unknown as number] })
    )
  })
})
