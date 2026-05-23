import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import logger from '@adonisjs/core/services/logger'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import User from '#models/user'
import { invalidateSnapshotCache } from '#services/inventory_service'
import { audit } from '#services/audit'
import { nextStage } from '#services/stage_advancement'
import { completeJobInTrx } from '#services/job_costing'
import { DateTime } from 'luxon'

const TICK_INTERVAL_MS = 30_000
const BATCH_SIZE = 50
let timer: NodeJS.Timeout | null = null
let systemActor: User | null = null

export async function selectEligibleJobIds(
  trx: TransactionClientContract,
  limit: number
): Promise<number[]> {
  const rows = await trx
    .knexQuery()
    .from('production_jobs')
    .select('id')
    .where('status', 'in_progress')
    .whereNotNull('auto_complete_at')
    .whereRaw('auto_complete_at <= NOW()')
    .orderBy('auto_complete_at', 'asc')
    .limit(limit)
    .forUpdate()
    .skipLocked()
  return rows.map((r: any) => r.id as number)
}

async function getSystemActor(): Promise<User> {
  if (systemActor) return systemActor
  // The scheduler attributes audit events to the first owner user. If no
  // owner exists yet (fresh install), the audit is anonymous (actor = null
  // is accepted by audit()).
  systemActor = (await User.query().where('is_owner', true).first()) as User | null
  return systemActor as User
}

export async function tick(): Promise<number> {
  const eligibleIds = await db.transaction((trx) => selectEligibleJobIds(trx, BATCH_SIZE))
  if (eligibleIds.length === 0) return 0

  const actor = await getSystemActor()
  let advanced = 0
  for (const id of eligibleIds) {
    await db.transaction(async (trx) => {
      const job = await ProductionJob.query({ client: trx })
        .where('id', id)
        .forUpdate()
        .firstOrFail()
      // Re-check the state under lock — another worker or a user action
      // may have moved this job since the SELECT.
      if (job.status !== 'in_progress' || !job.autoCompleteAt) return
      if (job.autoCompleteAt.toMillis() > DateTime.now().toMillis()) return

      if (!job.currentStageId) {
        // No stage on an in_progress job is a data inconsistency; flip to
        // awaiting_confirmation rather than crash the scheduler.
        job.status = 'awaiting_confirmation'
        job.autoCompleteAt = null
        await job.save()
        return
      }
      const stage = await ProductionJobStage.query({ client: trx })
        .where('id', job.currentStageId)
        .forUpdate()
        .firstOrFail()
      stage.status = 'completed'
      stage.completedAt = DateTime.now()
      await stage.save()

      const allStages = await ProductionJobStage.query({ client: trx })
        .where('job_id', job.id)
        .orderBy('sequence', 'asc')
      const next = nextStage(
        allStages as any as import('#services/stage_advancement').StageLike[],
        stage.sequence
      ) as ProductionJobStage | null
      const now = DateTime.now()
      if (next) {
        next.status = 'in_progress'
        next.startedAt = now
        next.autoCompleteAt = now.plus({ minutes: next.estimatedDurationMin })
        next.useTransaction(trx)
        await next.save()
        job.currentStageId = next.id
        job.estimatedDurationMin = next.estimatedDurationMin
        job.autoCompleteAt = next.autoCompleteAt
        await job.save()
        await audit({
          actor,
          action: 'job.stage_advance',
          targetType: 'job',
          targetId: job.id,
          payload: { toStageId: next.id, sequence: next.sequence },
          trx,
        })
      } else {
        // Final stage finished — auto-complete the job (no manual confirm).
        await completeJobInTrx(job, job.plannedQty, actor, trx)
        await audit({
          actor,
          action: 'job.auto_timer_expired',
          targetType: 'job',
          targetId: job.id,
          trx,
        })
      }
      advanced++
    })
  }
  if (advanced > 0) await invalidateSnapshotCache()
  return advanced
}

export function start(): void {
  if (timer) return
  if (process.env.SCHEDULER_ENABLED !== 'true') {
    logger.info({ scheduler: 'job_auto_complete' }, 'scheduler disabled (SCHEDULER_ENABLED!=true)')
    return
  }
  timer = setInterval(() => {
    tick().catch((err) => logger.error({ err }, 'scheduler tick failed'))
  }, TICK_INTERVAL_MS)
  // Don't keep the process alive solely for the scheduler in tests.
  timer.unref?.()
  logger.info({ scheduler: 'job_auto_complete', intervalMs: TICK_INTERVAL_MS }, 'scheduler started')
}

export function stop(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
