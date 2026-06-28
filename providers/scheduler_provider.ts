import type { ApplicationService } from '@adonisjs/core/types'
import { start, stop } from '#services/job_auto_complete_scheduler'
import { start as startMetrics, stop as stopMetrics } from '#services/metrics_snapshot_scheduler'

export default class SchedulerProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    // Only run schedulers in 'web' processes. Test runs and ace commands
    // skip them; opt-in via SCHEDULER_ENABLED inside each service.
    if (this.app.getEnvironment() === 'web') {
      start()
      startMetrics()
    }
  }

  async shutdown() {
    stop()
    stopMetrics()
  }
}
