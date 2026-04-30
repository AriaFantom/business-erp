import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { updateProfileValidator, updateAvatarValidator } from '#validators/profile'

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

test.group('updateProfileValidator', () => {
  test('accepts valid first/last name', async ({ assert }) => {
    const out = await updateProfileValidator.validate({
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
    assert.equal(out.firstName, 'Ada')
    assert.equal(out.lastName, 'Lovelace')
  })

  test('accepts null first/last name', async ({ assert }) => {
    const out = await updateProfileValidator.validate({
      firstName: null,
      lastName: null,
    })
    assert.isNull(out.firstName)
    assert.isNull(out.lastName)
  })

  test('rejects names longer than 80 chars', async ({ assert }) => {
    const long = 'x'.repeat(81)
    const messages = await expectValidationFailure(() =>
      updateProfileValidator.validate({ firstName: long, lastName: null })
    )
    assert.isTrue(messages.some((m) => m.field === 'firstName'))
  })
})

test.group('updateAvatarValidator', () => {
  test('rejects missing file', async ({ assert }) => {
    const messages = await expectValidationFailure(() => updateAvatarValidator.validate({}))
    assert.isTrue(messages.some((m) => m.field === 'avatar'))
  })
})
