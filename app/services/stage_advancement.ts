export interface StageLike {
  id: number
  sequence: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  estimatedDurationMin: number
  name: string
}

/**
 * Given the full ordered stage list of a job and the sequence of the stage
 * that just finished, return the next stage that should run, or null if the
 * job is done. Pure function so it stays trivially testable.
 */
export function nextStage<S extends StageLike>(stages: S[], finishedSequence: number): S | null {
  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence)
  for (const s of sorted) {
    if (s.sequence <= finishedSequence) continue
    if (s.status === 'pending') return s
  }
  return null
}
