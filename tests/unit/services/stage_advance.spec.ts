import { test } from '@japa/runner'
import { nextStage } from '#services/stage_advancement'

test.group('stage_advancement.nextStage', () => {
  test('returns the next pending stage by sequence', ({ assert }) => {
    const stages = [
      { id: 1, sequence: 1, status: 'completed' as const, estimatedDurationMin: 5, name: 'a' },
      { id: 2, sequence: 2, status: 'pending' as const, estimatedDurationMin: 7, name: 'b' },
      { id: 3, sequence: 3, status: 'pending' as const, estimatedDurationMin: 9, name: 'c' },
    ]
    assert.equal(nextStage(stages, 1)?.id, 2)
  })

  test('skips already-completed/skipped intermediate stages', ({ assert }) => {
    const stages = [
      { id: 1, sequence: 1, status: 'completed' as const, estimatedDurationMin: 5, name: 'a' },
      { id: 2, sequence: 2, status: 'skipped' as const, estimatedDurationMin: 7, name: 'b' },
      { id: 3, sequence: 3, status: 'pending' as const, estimatedDurationMin: 9, name: 'c' },
    ]
    assert.equal(nextStage(stages, 1)?.id, 3)
  })

  test('returns null when no more pending stages', ({ assert }) => {
    const stages = [
      { id: 1, sequence: 1, status: 'completed' as const, estimatedDurationMin: 5, name: 'a' },
      { id: 2, sequence: 2, status: 'completed' as const, estimatedDurationMin: 7, name: 'b' },
    ]
    assert.isNull(nextStage(stages, 2))
  })
})
