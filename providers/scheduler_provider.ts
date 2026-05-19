import type { ApplicationService } from '@adonisjs/core/types'
import { start, stop } from '#services/job_auto_complete_scheduler'

export default class SchedulerProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    // Only run the scheduler in 'web' processes. Test runs and ace commands
    // skip it; opt-in via SCHEDULER_ENABLED inside the service.
    if (this.app.getEnvironment() === 'web') start()
  }

  async shutdown() {
    stop()
  }
}
