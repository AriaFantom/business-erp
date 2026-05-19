# Job Timer, Multi-Stage Prints, and Printer Resources — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-19-job-timer-and-printers-design.md`

**Goal:** Add a 3D-printer-aware production workflow with multi-stage timed prints, pause/resume, scheduler-driven auto-advancement to an `awaiting_confirmation` state, and printer-anchored expense tracking.

**Architecture:** Five additive Postgres migrations introduce printers, job stages, timer fields, and a generalised `expenses` table (renamed from `job_expenses`). A new background scheduler service polls every 30s for jobs whose active stage has expired and advances them in a transaction guarded by `FOR UPDATE SKIP LOCKED`. Job state machine extends to `paused` and `awaiting_confirmation`; the printer is held throughout. Purchase confirmation gains a side-effect that creates `printers` rows for `item_kind='printer'` lines.

**Tech Stack:** AdonisJS v7, Lucid ORM, Postgres, VineJS validators, Inertia + React 19, Tailwind v4, shadcn (`radix-vega`), Japa test runner.

**Reading order for the engineer:** start with the spec, then `app/services/job_costing.ts` (existing flow you'll be extending), then this plan top-to-bottom.

**Convention notes:**
- Schema additions made by `node ace migration:run` regenerate `database/schema.ts`. **Never edit that file by hand.**
- Custom model fields/methods go on the model class, not the auto-generated `*Schema` parent.
- Permission strings (e.g. `'jobs.start'`) are checked via `bouncer.authorize('jobs.start' as never)`; there is no per-permission ability definition in `app/abilities/main.ts` — strings are matched against `user.getPermissions()`.
- View models live in `app/services/*_view_models.ts` and return plain shaped objects (no transformer classes despite what CLAUDE.md suggests — that file is aspirational; follow the actual code in `jobs_view_models.ts`).
- Migration timestamps continue the existing sequence `1778000000xxx`; the latest in the tree is `280`. Use `300, 310, 320, 330, 340` to leave room.

---

## File Structure

**Database migrations (`database/migrations/`)**
- `1778000000300_create_printers_table.ts`
- `1778000000310_add_timer_and_printer_fields_to_production_jobs.ts`
- `1778000000320_rename_job_expenses_to_expenses_with_printer_id.ts`
- `1778000000330_add_printer_kind_check_to_purchase_items.ts`
- `1778000000340_create_production_job_stages_and_current_stage_fk.ts`

**Models (`app/models/`)**
- `printer.ts` (new)
- `production_job_stage.ts` (new)
- `expense.ts` (new; replaces `job_expense.ts`)
- `production_job.ts` (modify: add `printer`, `currentStage`, `stages`, `expenses` relations)
- `job_expense.ts` (delete)

**Services (`app/services/`)**
- `printer_service.ts` (new — create, retire, toggleMaintenance, recordPrinterExpense)
- `job_auto_complete_scheduler.ts` (new — tick query, stage advance, awaiting_confirmation handoff)
- `job_costing.ts` (modify — `startJob` takes printer + stages; add `pauseJob`, `resumeJob`, `skipStage`, `confirmJob`; modify `failJob`, `cancelJob`, `recordExpense`)
- `purchase_service.ts` (modify — in `confirmPurchase`, create printer rows for `item_kind='printer'` lines; skip inventory movement for those)
- `jobs_view_models.ts` (modify — include printer, stages, timer fields)
- `printers_view_models.ts` (new — index/show view models)

**Providers (`providers/`)**
- `scheduler_provider.ts` (new — boots the scheduler in `ready()`)

**Validators (`app/validators/`)**
- `jobs.ts` (modify — extend `createJobValidator`/start payload; add `pauseJobValidator` placeholder if needed; add `confirmJobValidator`)
- `printers.ts` (new — create/update/expense validators)

**Controllers (`app/controllers/`)**
- `printers_controller.ts` (new)
- `jobs_controller.ts` (modify — replace `complete` with `confirm`; add `pause`, `resume`, `skipStage`; modify `start` signature)

**Routes (`start/routes.ts`)** — add printer block; modify jobs block.

**Inertia frontend (`inertia/`)**
- `pages/printers/index.tsx`, `pages/printers/new.tsx`, `pages/printers/show.tsx` (new)
- `pages/jobs/show.tsx` (modify)
- `pages/jobs/index.tsx` (modify — start modal)
- `pages/purchases/show.tsx` (modify — link to printers)
- `components/jobs/job-countdown.tsx` (new)
- `components/jobs/job-stages-list.tsx` (new)
- `components/jobs/job-stages-repeater.tsx` (new — start form)

**Tests (`tests/`)**
- `unit/services/scheduler_eligible_jobs.spec.ts`
- `unit/services/stage_advance.spec.ts`
- `functional/jobs/start_with_printer.spec.ts`
- `functional/jobs/auto_complete.spec.ts`
- `functional/jobs/multi_stage.spec.ts`
- `functional/jobs/pause_resume.spec.ts`
- `functional/jobs/confirm.spec.ts`
- `functional/printers/index.spec.ts`
- `functional/printers/purchase_creates_printer.spec.ts`
- `functional/expenses/printer_expense.spec.ts`

---

## Phase 1 — Database and Models

### Task 1: Migration — `printers` table

**Files:**
- Create: `database/migrations/1778000000300_create_printers_table.ts`

- [ ] **Step 1: Create the migration file**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'printers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable().unique()
      table.string('model').nullable()
      table.string('serial_number').nullable()
      // 'idle' | 'printing' | 'maintenance' | 'offline' | 'retired'
      table.string('status').notNullable().defaultTo('idle')
      table.integer('current_job_id').unsigned().nullable()
      // FK to production_jobs added in migration 310 (currently nullable so no
      // ordering issue, but we delay the reference until production_jobs has
      // the matching reverse pointer).
      table
        .integer('purchase_item_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('purchase_items')
        .onDelete('SET NULL')
      table.timestamp('acquired_at', { useTz: true }).nullable()
      table.text('notes').nullable()
      table.timestamps(true, true)
      table.index(['status'])
    })
    this.schema.raw(
      `CREATE UNIQUE INDEX printers_current_job_uidx
       ON printers (current_job_id)
       WHERE current_job_id IS NOT NULL`
    )
  }

  async down() {
    this.schema.raw(`DROP INDEX IF EXISTS printers_current_job_uidx`)
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: Run migration and regenerate schema**

Run: `node ace migration:run`
Expected: migration runs successfully; `database/schema.ts` now contains a `PrinterSchema` export.

- [ ] **Step 3: Verify table shape**

Run: `psql -U dev -h localhost -d dev -c "\d printers"` (password `dev`)
Expected: columns and partial unique index `printers_current_job_uidx` present.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/1778000000300_create_printers_table.ts database/schema.ts
git commit -m "feat(db): add printers table"
```

---

### Task 2: Printer model

**Files:**
- Create: `app/models/printer.ts`

- [ ] **Step 1: Create the model**

```ts
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { PrinterSchema } from '#database/schema'
import ProductionJob from '#models/production_job'
import PurchaseItem from '#models/purchase_item'

export default class Printer extends PrinterSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'currentJobId' })
  declare currentJob: BelongsTo<typeof ProductionJob>

  @belongsTo(() => PurchaseItem, { foreignKey: 'purchaseItemId' })
  declare purchaseItem: BelongsTo<typeof PurchaseItem>

  @hasMany(() => ProductionJob, { foreignKey: 'printerId' })
  declare jobs: HasMany<typeof ProductionJob>
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add app/models/printer.ts
git commit -m "feat(models): add Printer model"
```

---

### Task 3: Migration — timer/printer fields on `production_jobs`

**Files:**
- Create: `database/migrations/1778000000310_add_timer_and_printer_fields_to_production_jobs.ts`

- [ ] **Step 1: Create the migration**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_jobs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('printer_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('printers')
        .onDelete('RESTRICT')
      table.integer('estimated_duration_min').nullable()
      table.timestamp('auto_complete_at', { useTz: true }).nullable()
      // current_stage_id FK is added in migration 340 once the stages table
      // exists. Defined here as a bare integer so the column already exists
      // when services start touching the row.
      table.integer('current_stage_id').unsigned().nullable()
      table.timestamp('paused_at', { useTz: true }).nullable()
      table.integer('remaining_seconds').nullable()
    })
    this.schema.raw(
      `CREATE UNIQUE INDEX production_jobs_active_printer_uidx
       ON production_jobs (printer_id)
       WHERE status IN ('in_progress', 'paused', 'awaiting_confirmation')`
    )
    this.schema.raw(
      `CREATE INDEX production_jobs_auto_complete_at_idx
       ON production_jobs (auto_complete_at)
       WHERE status = 'in_progress'`
    )
  }

  async down() {
    this.schema.raw(`DROP INDEX IF EXISTS production_jobs_auto_complete_at_idx`)
    this.schema.raw(`DROP INDEX IF EXISTS production_jobs_active_printer_uidx`)
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('remaining_seconds')
      table.dropColumn('paused_at')
      table.dropColumn('current_stage_id')
      table.dropColumn('auto_complete_at')
      table.dropColumn('estimated_duration_min')
      table.dropColumn('printer_id')
    })
  }
}
```

- [ ] **Step 2: Run migration**

Run: `node ace migration:run`
Expected: `database/schema.ts` `ProductionJobSchema` now lists `printerId`, `autoCompleteAt`, `currentStageId`, `pausedAt`, `remainingSeconds`, `estimatedDurationMin`.

- [ ] **Step 3: Update `ProductionJob` model with the new relation**

Modify `app/models/production_job.ts`:

```ts
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ProductionJobSchema } from '#database/schema'
import Product from '#models/product'
import User from '#models/user'
import JobMaterialConsumption from '#models/job_material_consumption'
// JobExpense import will be replaced with Expense in Task 6; leave as-is for now.
import JobExpense from '#models/job_expense'
import Printer from '#models/printer'

export default class ProductionJob extends ProductionJobSchema {
  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => ProductionJob, { foreignKey: 'parentJobId' })
  declare parentJob: BelongsTo<typeof ProductionJob>

  @hasMany(() => JobMaterialConsumption, { foreignKey: 'jobId' })
  declare consumptions: HasMany<typeof JobMaterialConsumption>

  @hasMany(() => JobExpense, { foreignKey: 'jobId' })
  declare expenses: HasMany<typeof JobExpense>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => Printer, { foreignKey: 'printerId' })
  declare printer: BelongsTo<typeof Printer>
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/1778000000310_add_timer_and_printer_fields_to_production_jobs.ts database/schema.ts app/models/production_job.ts
git commit -m "feat(db): add printer_id and timer fields to production_jobs"
```

---

### Task 4: Migration — rename `job_expenses` to `expenses`, add `printer_id`

**Files:**
- Create: `database/migrations/1778000000320_rename_job_expenses_to_expenses_with_printer_id.ts`

- [ ] **Step 1: Create the migration**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.renameTable('job_expenses', 'expenses')
    this.schema.alterTable('expenses', (table) => {
      table.integer('job_id').unsigned().nullable().alter()
      table
        .integer('printer_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('printers')
        .onDelete('RESTRICT')
      table.index(['printer_id'])
    })
    this.schema.raw(
      `ALTER TABLE expenses
       ADD CONSTRAINT expenses_anchor_chk
       CHECK (job_id IS NOT NULL OR printer_id IS NOT NULL)`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_anchor_chk`)
    this.schema.alterTable('expenses', (table) => {
      table.dropIndex(['printer_id'])
      table.dropColumn('printer_id')
      table.integer('job_id').unsigned().notNullable().alter()
    })
    this.schema.renameTable('expenses', 'job_expenses')
  }
}
```

- [ ] **Step 2: Run migration**

Run: `node ace migration:run`
Expected: regenerated `database/schema.ts` now has `ExpenseSchema` (no more `JobExpenseSchema`), with `jobId: number | null` and `printerId: number | null`.

- [ ] **Step 3: Verify constraint**

Run:
```bash
psql -U dev -h localhost -d dev -c "\d+ expenses"
```
Expected: includes `expenses_anchor_chk` check constraint.

- [ ] **Step 4: Commit (schema-only — code refactor follows in Task 6)**

```bash
git add database/migrations/1778000000320_rename_job_expenses_to_expenses_with_printer_id.ts database/schema.ts
git commit -m "feat(db): rename job_expenses to expenses, add printer_id anchor"
```

---

### Task 5: Migration — `purchase_items` printer-kind check

**Files:**
- Create: `database/migrations/1778000000330_add_printer_kind_check_to_purchase_items.ts`

- [ ] **Step 1: Create the migration**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      `ALTER TABLE purchase_items
       ADD CONSTRAINT purchase_items_printer_qty_chk
       CHECK (item_kind <> 'printer' OR (qty = floor(qty) AND qty >= 1))`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_printer_qty_chk`)
  }
}
```

- [ ] **Step 2: Run migration and commit**

Run: `node ace migration:run`

```bash
git add database/migrations/1778000000330_add_printer_kind_check_to_purchase_items.ts database/schema.ts
git commit -m "feat(db): enforce integer qty for printer purchase lines"
```

---

### Task 6: Replace `JobExpense` model with `Expense`

**Files:**
- Create: `app/models/expense.ts`
- Delete: `app/models/job_expense.ts`
- Modify: `app/models/production_job.ts` (relation now points to `Expense`)
- Modify: any file importing `#models/job_expense` (`app/services/job_costing.ts`, `app/services/jobs_view_models.ts`)

- [ ] **Step 1: Create `app/models/expense.ts`**

```ts
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ExpenseSchema } from '#database/schema'
import ProductionJob from '#models/production_job'
import Printer from '#models/printer'

export default class Expense extends ExpenseSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof ProductionJob>

  @belongsTo(() => Printer, { foreignKey: 'printerId' })
  declare printer: BelongsTo<typeof Printer>
}
```

- [ ] **Step 2: Delete the old model**

```bash
git rm app/models/job_expense.ts
```

- [ ] **Step 3: Update `production_job.ts` to point at `Expense`**

In `app/models/production_job.ts`, replace:

```ts
import JobExpense from '#models/job_expense'
```
with:
```ts
import Expense from '#models/expense'
```
And:
```ts
@hasMany(() => JobExpense, { foreignKey: 'jobId' })
declare expenses: HasMany<typeof JobExpense>
```
becomes:
```ts
@hasMany(() => Expense, { foreignKey: 'jobId' })
declare expenses: HasMany<typeof Expense>
```

- [ ] **Step 4: Update `app/services/job_costing.ts`**

Replace `import JobExpense from '#models/job_expense'` with `import Expense from '#models/expense'`. Replace every `JobExpense` identifier with `Expense`. The return type of `recordExpense` becomes `Promise<Expense>`. The query `JobExpense.query({ client: trx }).where('job_id', jobId)` becomes `Expense.query({ client: trx }).where('job_id', jobId)`.

- [ ] **Step 5: Update `app/services/jobs_view_models.ts`**

Replace `import JobExpense from '#models/job_expense'` with `import Expense from '#models/expense'`. Replace `JobExpense.query(...)` with `Expense.query(...)`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: passes. (If any other file referenced `JobExpense`, fix the same way.)

- [ ] **Step 7: Commit**

```bash
git add app/models/expense.ts app/models/production_job.ts app/services/job_costing.ts app/services/jobs_view_models.ts
git rm app/models/job_expense.ts
git commit -m "refactor: rename JobExpense model to Expense"
```

---

### Task 7: Migration — `production_job_stages` table and `current_stage_id` FK

**Files:**
- Create: `database/migrations/1778000000340_create_production_job_stages_and_current_stage_fk.ts`
- Create: `app/models/production_job_stage.ts`

- [ ] **Step 1: Create the migration**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_job_stages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('job_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('production_jobs')
        .onDelete('CASCADE')
      table.integer('sequence').notNullable()
      table.string('name').notNullable()
      table.integer('estimated_duration_min').notNullable()
      // 'pending' | 'in_progress' | 'completed' | 'skipped'
      table.string('status').notNullable().defaultTo('pending')
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamp('auto_complete_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.unique(['job_id', 'sequence'])
      table.index(['job_id', 'status'])
    })
    this.schema.raw(
      `ALTER TABLE production_jobs
       ADD CONSTRAINT production_jobs_current_stage_fk
       FOREIGN KEY (current_stage_id)
       REFERENCES production_job_stages(id)
       ON DELETE SET NULL`
    )
  }

  async down() {
    this.schema.raw(
      `ALTER TABLE production_jobs DROP CONSTRAINT IF EXISTS production_jobs_current_stage_fk`
    )
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: Run migration**

Run: `node ace migration:run`
Expected: `database/schema.ts` now has `ProductionJobStageSchema`.

- [ ] **Step 3: Create the model**

`app/models/production_job_stage.ts`:

```ts
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductionJobStageSchema } from '#database/schema'
import ProductionJob from '#models/production_job'

export default class ProductionJobStage extends ProductionJobStageSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof ProductionJob>
}
```

- [ ] **Step 4: Add `stages` + `currentStage` relations to `ProductionJob`**

Add to `app/models/production_job.ts`:

```ts
import ProductionJobStage from '#models/production_job_stage'
// ...
@hasMany(() => ProductionJobStage, { foreignKey: 'jobId' })
declare stages: HasMany<typeof ProductionJobStage>

@belongsTo(() => ProductionJobStage, { foreignKey: 'currentStageId' })
declare currentStage: BelongsTo<typeof ProductionJobStage>
```

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add database/migrations/1778000000340_create_production_job_stages_and_current_stage_fk.ts database/schema.ts app/models/production_job_stage.ts app/models/production_job.ts
git commit -m "feat(db): add production_job_stages table and FK"
```

---

## Phase 2 — Domain Services

### Task 8: Pure stage-advancement helper (unit-tested)

Pull the "given a sorted list of stages and a current sequence, decide the next stage or return null" logic into a pure function so the scheduler tick and `skipStage` share one implementation, and so we can unit-test it without DB.

**Files:**
- Create: `app/services/stage_advancement.ts`
- Test: `tests/unit/services/stage_advance.spec.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/services/stage_advance.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test (expect FAIL — file not present)**

Run: `node ace test --files="tests/unit/services/stage_advance.spec.ts"`
Expected: import error / FAIL.

- [ ] **Step 3: Implement**

`app/services/stage_advancement.ts`:

```ts
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
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `node ace test --files="tests/unit/services/stage_advance.spec.ts"`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/services/stage_advancement.ts tests/unit/services/stage_advance.spec.ts
git commit -m "feat(services): pure stage-advancement helper"
```

---

### Task 9: Extend `startJob` to take `printerId` and `stages[]`

**Files:**
- Modify: `app/services/job_costing.ts`
- Modify: `app/validators/jobs.ts`
- Test: `tests/functional/jobs/start_with_printer.spec.ts`

- [ ] **Step 1: Update validator**

In `app/validators/jobs.ts`, replace the old `completeJobValidator` and add a new `startJobValidator` and `confirmJobValidator`:

```ts
export const startJobValidator = vine.compile(
  vine.object({
    printerId: vine.number().positive(),
    stages: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(1).maxLength(80),
          durationMinutes: vine.number().min(1).max(60 * 24 * 14), // up to 14 days
        })
      )
      .minLength(1)
      .maxLength(20),
  })
)

export const confirmJobValidator = vine.compile(
  vine.object({
    producedQty: vine.number().min(0).max(1_000_000),
  })
)
```

The existing `completeJobValidator` can stay in the file (used by tests and possible API clients) but is no longer wired from the controller after Task 13.

- [ ] **Step 2: Write the failing functional test**

`tests/functional/jobs/start_with_printer.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import { startJob } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('startJob with printer', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('assigns printer, stages, and timer; flips printer to printing', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const printer = await Printer.create({ name: 'A1', status: 'idle' })

    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [
        { name: 'Layer 1', durationMinutes: 30 },
        { name: 'Layer 2', durationMinutes: 60 },
      ],
      actor,
    })

    const reloaded = await ProductionJob.findOrFail(job.id)
    assert.equal(reloaded.status, 'in_progress')
    assert.equal(reloaded.printerId, printer.id)
    assert.equal(reloaded.estimatedDurationMin, 30)
    assert.isNotNull(reloaded.autoCompleteAt)
    assert.isNotNull(reloaded.currentStageId)

    const stages = await ProductionJobStage.query().where('job_id', job.id).orderBy('sequence')
    assert.lengthOf(stages, 2)
    assert.equal(stages[0].status, 'in_progress')
    assert.equal(stages[1].status, 'pending')

    const printerR = await Printer.findOrFail(printer.id)
    assert.equal(printerR.status, 'printing')
    assert.equal(printerR.currentJobId, job.id)
  })

  test('rejects starting when printer is not idle', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'A2', status: 'printing' })
    await assert.rejects(() =>
      startJob({
        jobId: job.id,
        printerId: printer.id,
        stages: [{ name: 's', durationMinutes: 10 }],
        actor,
      })
    )
  })

  test('two concurrent starts on the same printer cannot both succeed', async ({ assert }) => {
    // Create two draft jobs and one idle printer; run startJob twice
    // concurrently and assert exactly one resolves while the other rejects
    // (DB unique-index violation translated into a DomainError).
    const { job: jobA, actor } = await setupJobFixture({ withRecipe: false })
    const { job: jobB } = await setupJobFixture({ withRecipe: false, actor })
    const printer = await Printer.create({ name: 'A3', status: 'idle' })

    const args = (id: number) => ({
      jobId: id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 10 }],
      actor,
    })
    const results = await Promise.allSettled([startJob(args(jobA.id)), startJob(args(jobB.id))])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    assert.lengthOf(fulfilled, 1)
    assert.lengthOf(rejected, 1)
  })
})
```

Also create the test helper:

`tests/helpers/job_fixtures.ts`:

```ts
import User from '#models/user'
import Product from '#models/product'
import ProductionJob from '#models/production_job'
import { DateTime } from 'luxon'
import { nextDocNumber } from '#services/numbering'
import db from '@adonisjs/lucid/services/db'

export async function setupJobFixture(opts: {
  plannedQty?: number
  withRecipe?: boolean
  actor?: User
}): Promise<{ job: ProductionJob; product: Product; actor: User }> {
  const actor =
    opts.actor ??
    (await User.create({
      email: `tester+${Date.now()}.${Math.random()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'T',
      lastName: 'U',
    }))
  const product = await Product.create({
    sku: `SKU${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: 'Test product',
    isActive: true,
    defaultUnit: 'pcs',
    defaultPrice: '0',
    categoryId: null,
  } as any)
  const number = await db.transaction((trx) => nextDocNumber('JOB', trx))
  const job = await ProductionJob.create({
    number,
    productId: product.id,
    plannedQty: opts.plannedQty ?? 1,
    producedQty: 0,
    status: 'draft',
    totalMaterialCost: '0',
    totalComponentCost: '0',
    totalExpense: '0',
    totalCost: '0',
    unitCost: '0',
    createdByUserId: actor.id,
  } as any)
  return { job, product, actor }
}
```

> Note: the `Product.create` payload uses `as any` because the live model may have stricter required fields. If typecheck complains, fill in the additional required fields from the live `ProductSchema` (it's auto-generated — read `database/schema.ts` for the full list).

- [ ] **Step 3: Run test (expect FAIL — startJob still has old signature)**

Run: `node ace test --files="tests/functional/jobs/start_with_printer.spec.ts"`
Expected: type errors or runtime failures.

- [ ] **Step 4: Update `startJob` in `app/services/job_costing.ts`**

Replace the existing `startJob` function with:

```ts
import Printer from '#models/printer'
import ProductionJobStage from '#models/production_job_stage'
import { DomainError, InvalidStateError } from '#services/domain_errors'

export interface StartJobStageInput {
  name: string
  durationMinutes: number
}

export async function startJob(input: {
  jobId: number
  printerId: number
  stages: StartJobStageInput[]
  actor: User
}): Promise<ProductionJob> {
  if (input.stages.length === 0) {
    throw new DomainError('A job must have at least one stage.')
  }

  const result = await db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', input.jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'draft') {
      throw new InvalidStateError({ entity: 'job', from: job.status, to: 'in_progress' })
    }

    const printer = await Printer.query({ client: trx })
      .where('id', input.printerId)
      .forUpdate()
      .firstOrFail()
    if (printer.status !== 'idle') {
      throw new InvalidStateError({
        entity: 'printer',
        from: printer.status,
        to: `assign job ${job.id}`,
      })
    }

    // Insert all stages
    const now = DateTime.now()
    const stageRows: ProductionJobStage[] = []
    for (let i = 0; i < input.stages.length; i++) {
      const s = input.stages[i]
      const row = new ProductionJobStage()
      row.jobId = job.id
      row.sequence = i + 1
      row.name = s.name
      row.estimatedDurationMin = s.durationMinutes
      row.status = i === 0 ? 'in_progress' : 'pending'
      if (i === 0) {
        row.startedAt = now
        row.autoCompleteAt = now.plus({ minutes: s.durationMinutes })
      }
      row.useTransaction(trx)
      await row.save()
      stageRows.push(row)
    }

    job.status = 'in_progress'
    job.startedAt = now
    job.printerId = printer.id
    job.currentStageId = stageRows[0].id
    job.estimatedDurationMin = stageRows[0].estimatedDurationMin
    job.autoCompleteAt = stageRows[0].autoCompleteAt
    await job.save()

    printer.status = 'printing'
    printer.currentJobId = job.id
    await printer.save()

    await audit({
      actor: input.actor,
      action: 'job.start',
      targetType: 'job',
      targetId: job.id,
      payload: {
        printerId: printer.id,
        stages: input.stages.map((s) => ({ name: s.name, durationMinutes: s.durationMinutes })),
      },
      trx,
    })

    // Recipe auto-consume (unchanged from prior behaviour).
    const recipe = await ProductRecipe.query({ client: trx }).where('product_id', job.productId)
    for (const r of recipe) {
      const qty = round4(Number(r.qtyPerUnit) * job.plannedQty)
      if (qty <= 0) continue
      await recordConsumptionInTrx(
        {
          jobId: job.id,
          itemKind: r.itemKind as 'material' | 'component',
          itemId: r.itemId,
          qtyConsumed: qty,
          reason: 'consume',
          actor: input.actor,
        },
        trx
      )
    }

    return job
  })

  await invalidateSnapshotCache()
  return result
}
```

- [ ] **Step 5: Update existing tests/callers if any break**

Search for `startJob(` and update sites:
```bash
grep -rn "startJob(" app/ tests/
```
The only caller before this PR is `JobsController.start`; you'll fix that in Task 14.

- [ ] **Step 6: Run the new functional test (expect PASS)**

Run: `node ace test --files="tests/functional/jobs/start_with_printer.spec.ts"`
Expected: all 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/services/job_costing.ts app/validators/jobs.ts tests/functional/jobs/start_with_printer.spec.ts tests/helpers/job_fixtures.ts
git commit -m "feat(jobs): startJob takes printer and stages; lock printer"
```

---

### Task 10: `pauseJob` and `resumeJob`

**Files:**
- Modify: `app/services/job_costing.ts`
- Test: `tests/functional/jobs/pause_resume.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import ProductionJob from '#models/production_job'
import { pauseJob, resumeJob, startJob } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('pauseJob / resumeJob', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('pause clears auto_complete_at, sets remaining_seconds', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'P1', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 60 }],
      actor,
    })
    await pauseJob(job.id, actor)
    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'paused')
    assert.isNull(j.autoCompleteAt)
    assert.isAtLeast(j.remainingSeconds ?? 0, 60 * 59) // within rounding tolerance
    assert.isAtMost(j.remainingSeconds ?? 0, 60 * 60)
    assert.isNotNull(j.pausedAt)
  })

  test('resume restores auto_complete_at = now + remaining_seconds', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'P2', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 60 }],
      actor,
    })
    await pauseJob(job.id, actor)
    await resumeJob(job.id, actor)
    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'in_progress')
    assert.isNull(j.pausedAt)
    assert.isNull(j.remainingSeconds)
    assert.isNotNull(j.autoCompleteAt)
  })

  test('pause rejects non-in-progress jobs', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    await assert.rejects(() => pauseJob(job.id, actor))
  })
})
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `node ace test --files="tests/functional/jobs/pause_resume.spec.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `app/services/job_costing.ts`:

```ts
export async function pauseJob(jobId: number, actor: User): Promise<ProductionJob> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'in_progress') {
      throw new InvalidStateError({ entity: 'job', from: job.status, to: 'paused' })
    }
    const now = DateTime.now()
    const remainingMs = (job.autoCompleteAt?.toMillis() ?? now.toMillis()) - now.toMillis()
    job.remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
    job.pausedAt = now
    job.autoCompleteAt = null
    job.status = 'paused'
    await job.save()

    if (job.currentStageId) {
      const stage = await ProductionJobStage.query({ client: trx })
        .where('id', job.currentStageId)
        .forUpdate()
        .firstOrFail()
      stage.autoCompleteAt = null
      await stage.save()
    }
    await audit({ actor, action: 'job.pause', targetType: 'job', targetId: job.id, trx })
    return job
  })
}

export async function resumeJob(jobId: number, actor: User): Promise<ProductionJob> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (job.status !== 'paused') {
      throw new InvalidStateError({ entity: 'job', from: job.status, to: 'in_progress' })
    }
    const now = DateTime.now()
    const remaining = job.remainingSeconds ?? 0
    const deadline = now.plus({ seconds: remaining })
    job.autoCompleteAt = deadline
    job.pausedAt = null
    job.remainingSeconds = null
    job.status = 'in_progress'
    await job.save()

    if (job.currentStageId) {
      const stage = await ProductionJobStage.query({ client: trx })
        .where('id', job.currentStageId)
        .forUpdate()
        .firstOrFail()
      stage.autoCompleteAt = deadline
      await stage.save()
    }
    await audit({ actor, action: 'job.resume', targetType: 'job', targetId: job.id, trx })
    return job
  })
}
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `node ace test --files="tests/functional/jobs/pause_resume.spec.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/job_costing.ts tests/functional/jobs/pause_resume.spec.ts
git commit -m "feat(jobs): pauseJob and resumeJob"
```

---

### Task 11: `skipStage` and shared `advanceStageOrAwaitConfirmation` helper

**Files:**
- Modify: `app/services/job_costing.ts`

(The scheduler tick in Task 12 will reuse this helper.)

- [ ] **Step 1: Implement the shared helper and `skipStage`**

Add to `app/services/job_costing.ts`:

```ts
import { nextStage } from '#services/stage_advancement'

/**
 * After marking the current stage finished (completed or skipped), activate
 * the next pending stage or move the job to awaiting_confirmation. Caller
 * provides the just-finished stage and the up-to-date job (locked).
 */
async function advanceStageOrAwaitConfirmation(
  job: ProductionJob,
  finishedSequence: number,
  trx: TransactionClientContract,
  actor: User
): Promise<void> {
  const stages = await ProductionJobStage.query({ client: trx })
    .where('job_id', job.id)
    .orderBy('sequence', 'asc')
  const next = nextStage(stages as any, finishedSequence)
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
    job.status = 'awaiting_confirmation'
    job.currentStageId = null
    job.autoCompleteAt = null
    await job.save()
    await audit({
      actor,
      action: 'job.auto_timer_expired',
      targetType: 'job',
      targetId: job.id,
      trx,
    })
  }
}

export async function skipStage(jobId: number, actor: User): Promise<ProductionJob> {
  return db.transaction(async (trx) => {
    const job = await ProductionJob.query({ client: trx })
      .where('id', jobId)
      .forUpdate()
      .firstOrFail()
    if (!['in_progress', 'paused'].includes(job.status)) {
      throw new InvalidStateError({ entity: 'job', from: job.status, to: 'skip_stage' })
    }
    if (!job.currentStageId) {
      throw new InvalidStateError({ entity: 'job', from: 'no_current_stage', to: 'skip_stage' })
    }
    const stage = await ProductionJobStage.query({ client: trx })
      .where('id', job.currentStageId)
      .forUpdate()
      .firstOrFail()
    stage.status = 'skipped'
    stage.completedAt = DateTime.now()
    await stage.save()

    // If the job was paused, advancing restores it to in_progress through
    // the next stage's started_at; if it was already in_progress, same.
    job.status = 'in_progress'
    await advanceStageOrAwaitConfirmation(job, stage.sequence, trx, actor)
    await audit({
      actor,
      action: 'job.stage_skip',
      targetType: 'job',
      targetId: job.id,
      payload: { skippedSequence: stage.sequence },
      trx,
    })
    return job
  })
}
```

- [ ] **Step 2: Quick verification test**

Add to `tests/functional/jobs/multi_stage.spec.ts` (full file written in Task 12; this entry is a placeholder reminder — implement it then).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add app/services/job_costing.ts
git commit -m "feat(jobs): skipStage and shared stage-advance helper"
```

---

### Task 12: Scheduler — `job_auto_complete_scheduler.ts`

**Files:**
- Create: `app/services/job_auto_complete_scheduler.ts`
- Create: `providers/scheduler_provider.ts`
- Modify: `adonisrc.ts` (register the provider)
- Test: `tests/unit/services/scheduler_eligible_jobs.spec.ts`
- Test: `tests/functional/jobs/auto_complete.spec.ts`
- Test: `tests/functional/jobs/multi_stage.spec.ts`

- [ ] **Step 1: Write the unit test for the query selector**

`tests/unit/services/scheduler_eligible_jobs.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import ProductionJob from '#models/production_job'
import Printer from '#models/printer'
import { selectEligibleJobIds } from '#services/job_auto_complete_scheduler'
import db from '@adonisjs/lucid/services/db'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('scheduler eligibility', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('selects only in_progress jobs past auto_complete_at', async ({ assert }) => {
    const { job: jobOverdue, actor } = await setupJobFixture({ withRecipe: false })
    const { job: jobFuture } = await setupJobFixture({ withRecipe: false, actor })
    const { job: jobPaused } = await setupJobFixture({ withRecipe: false, actor })
    const { job: jobDone } = await setupJobFixture({ withRecipe: false, actor })

    const past = DateTime.now().minus({ minutes: 5 })
    const future = DateTime.now().plus({ minutes: 30 })

    jobOverdue.merge({ status: 'in_progress', autoCompleteAt: past })
    await jobOverdue.save()
    jobFuture.merge({ status: 'in_progress', autoCompleteAt: future })
    await jobFuture.save()
    jobPaused.merge({ status: 'paused', autoCompleteAt: null })
    await jobPaused.save()
    jobDone.merge({ status: 'completed', autoCompleteAt: past })
    await jobDone.save()

    const ids = await db.transaction((trx) => selectEligibleJobIds(trx, 100))
    assert.includeMembers(ids, [jobOverdue.id])
    assert.notInclude(ids, jobFuture.id)
    assert.notInclude(ids, jobPaused.id)
    assert.notInclude(ids, jobDone.id)
  })
})
```

- [ ] **Step 2: Create the scheduler service**

`app/services/job_auto_complete_scheduler.ts`:

```ts
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import logger from '@adonisjs/core/services/logger'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import User from '#models/user'
import { invalidateSnapshotCache } from '#services/inventory_service'
import { audit } from '#services/audit'
import { nextStage } from '#services/stage_advancement'
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
      const next = nextStage(allStages as any, stage.sequence)
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
        job.status = 'awaiting_confirmation'
        job.autoCompleteAt = null
        job.currentStageId = null
        await job.save()
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
```

- [ ] **Step 3: Create the provider**

`providers/scheduler_provider.ts`:

```ts
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
```

- [ ] **Step 4: Register the provider in `adonisrc.ts`**

Open `adonisrc.ts` and add to the `providers` array:

```ts
() => import('#providers/scheduler_provider'),
```

Add `#providers/*` to the `imports` block in `package.json` if not already present (it is — see CLAUDE.md path aliases).

- [ ] **Step 5: Run the unit test**

Run: `node ace test --files="tests/unit/services/scheduler_eligible_jobs.spec.ts"`
Expected: PASS.

- [ ] **Step 6: Write the auto-complete functional test**

`tests/functional/jobs/auto_complete.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import ProductionJob from '#models/production_job'
import Printer from '#models/printer'
import { startJob } from '#services/job_costing'
import { tick } from '#services/job_auto_complete_scheduler'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('scheduler auto-complete (single stage)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('moves in_progress past deadline to awaiting_confirmation', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'X1', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 1 }],
      actor,
    })
    // Force the deadline into the past.
    await ProductionJob.query()
      .where('id', job.id)
      .update({ auto_complete_at: DateTime.now().minus({ minutes: 1 }).toSQL() })

    const advanced = await tick()
    assert.equal(advanced, 1)
    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'awaiting_confirmation')
    assert.isNull(j.autoCompleteAt)
    assert.isNull(j.currentStageId)
  })

  test('ignores paused jobs', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'X2', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 1 }],
      actor,
    })
    await ProductionJob.query()
      .where('id', job.id)
      .update({
        status: 'paused',
        auto_complete_at: null,
        paused_at: DateTime.now().toSQL(),
        remaining_seconds: 60,
      })
    const advanced = await tick()
    assert.equal(advanced, 0)
  })
})
```

- [ ] **Step 7: Write the multi-stage functional test**

`tests/functional/jobs/multi_stage.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import ProductionJob from '#models/production_job'
import ProductionJobStage from '#models/production_job_stage'
import Printer from '#models/printer'
import { skipStage, startJob } from '#services/job_costing'
import { tick } from '#services/job_auto_complete_scheduler'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('multi-stage job advancement', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('scheduler walks through three stages then awaits confirmation', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'M1', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [
        { name: '1', durationMinutes: 1 },
        { name: '2', durationMinutes: 1 },
        { name: '3', durationMinutes: 1 },
      ],
      actor,
    })

    for (let i = 0; i < 3; i++) {
      await ProductionJob.query()
        .where('id', job.id)
        .update({ auto_complete_at: DateTime.now().minus({ minutes: 1 }).toSQL() })
      await tick()
    }

    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'awaiting_confirmation')
    const stages = await ProductionJobStage.query()
      .where('job_id', job.id)
      .orderBy('sequence', 'asc')
    assert.deepEqual(
      stages.map((s) => s.status),
      ['completed', 'completed', 'completed']
    )
  })

  test('skipStage advances mid-job', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'M2', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [
        { name: '1', durationMinutes: 60 },
        { name: '2', durationMinutes: 60 },
      ],
      actor,
    })
    await skipStage(job.id, actor)
    const stages = await ProductionJobStage.query()
      .where('job_id', job.id)
      .orderBy('sequence', 'asc')
    assert.equal(stages[0].status, 'skipped')
    assert.equal(stages[1].status, 'in_progress')
  })
})
```

- [ ] **Step 8: Run all new tests**

Run: `node ace test --files="tests/functional/jobs/auto_complete.spec.ts" --files="tests/functional/jobs/multi_stage.spec.ts" --files="tests/unit/services/scheduler_eligible_jobs.spec.ts"`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add app/services/job_auto_complete_scheduler.ts providers/scheduler_provider.ts adonisrc.ts tests/functional/jobs/auto_complete.spec.ts tests/functional/jobs/multi_stage.spec.ts tests/unit/services/scheduler_eligible_jobs.spec.ts
git commit -m "feat(jobs): background scheduler advances stages and to awaiting_confirmation"
```

---

### Task 13: `confirmJob`, `failJob`, `cancelJob` updates, `recordExpense` printer support

**Files:**
- Modify: `app/services/job_costing.ts`
- Test: `tests/functional/jobs/confirm.spec.ts`
- Test: `tests/functional/expenses/printer_expense.spec.ts`

- [ ] **Step 1: Helper — free the printer when a job leaves active states**

Add to `app/services/job_costing.ts`:

```ts
async function freePrinter(
  job: ProductionJob,
  trx: TransactionClientContract
): Promise<void> {
  if (!job.printerId) return
  const printer = await Printer.query({ client: trx })
    .where('id', job.printerId)
    .forUpdate()
    .first()
  if (!printer) return
  printer.status = 'idle'
  printer.currentJobId = null
  await printer.save()
}
```

- [ ] **Step 2: Modify `completeJob` to be internally called by `confirmJob`, plus `failJob`/`cancelJob` to free printer**

In `completeJob`: after `await applyMovement(...)` for the produced product, call `await freePrinter(refreshed, trx)`.

In `failJob`: after `job.save()`, call `await freePrinter(job, trx)`. Also widen the allowed `from` set to include `paused` and `awaiting_confirmation`:

```ts
if (!['in_progress', 'draft', 'paused', 'awaiting_confirmation'].includes(job.status)) {
  throw new InvalidStateError({ entity: 'job', from: job.status, to: 'failed' })
}
```

In `cancelJob`: after `job.save()` for `status='cancelled'`, call `await freePrinter(job, trx)`.

- [ ] **Step 3: Add `confirmJob`**

```ts
export async function confirmJob(input: {
  jobId: number
  producedQty: number
  actor: User
}): Promise<ProductionJob> {
  // Pre-check status: confirm allowed from in_progress, paused, or awaiting_confirmation.
  const current = await ProductionJob.findOrFail(input.jobId)
  if (!['in_progress', 'paused', 'awaiting_confirmation'].includes(current.status)) {
    throw new InvalidStateError({ entity: 'job', from: current.status, to: 'completed' })
  }
  if (input.producedQty <= 0) {
    return failJob({ jobId: input.jobId, reason: 'confirmed zero output', actor: input.actor })
  }
  return completeJob({
    jobId: input.jobId,
    producedQty: input.producedQty,
    actor: input.actor,
  })
}
```

Also widen the `completeJob` allowed-from set to include `paused` and `awaiting_confirmation`:

```ts
if (!['in_progress', 'draft', 'paused', 'awaiting_confirmation'].includes(job.status)) {
  throw new InvalidStateError({ entity: 'job', from: job.status, to: 'completed' })
}
```

- [ ] **Step 4: Modify `recordExpense` to accept `printerId`**

Update the function signature and body:

```ts
export async function recordExpense(input: {
  jobId?: number | null
  printerId?: number | null
  kind: 'electricity' | 'labor' | 'overhead' | 'maintenance' | 'parts' | 'addon' | 'other'
  description: string
  amount: number
  incurredAt?: DateTime
  actor: User
}): Promise<Expense> {
  if (!input.jobId && !input.printerId) {
    throw new DomainError('Expense must be tied to a job or a printer.')
  }
  return db.transaction(async (trx) => {
    if (input.jobId) {
      const job = await ProductionJob.query({ client: trx })
        .where('id', input.jobId)
        .forUpdate()
        .firstOrFail()
      if (!['draft', 'in_progress', 'paused', 'awaiting_confirmation', 'completed', 'failed'].includes(job.status)) {
        throw new InvalidStateError({ entity: 'job', from: job.status, to: 'add_expense' })
      }
    }
    if (input.printerId) {
      await Printer.findOrFail(input.printerId)
    }
    const expense = new Expense()
    expense.jobId = input.jobId ?? null
    expense.printerId = input.printerId ?? null
    expense.kind = input.kind
    expense.description = input.description
    expense.amount = String(input.amount)
    expense.incurredAt = input.incurredAt ?? DateTime.now()
    expense.createdByUserId = input.actor.id
    expense.useTransaction(trx)
    await expense.save()

    if (input.jobId) {
      await recomputeJobTotals(input.jobId, trx)
    }
    await audit({
      actor: input.actor,
      action: 'expense.create',
      targetType: 'expense',
      targetId: expense.id,
      payload: { jobId: input.jobId ?? null, printerId: input.printerId ?? null, kind: input.kind, amount: input.amount },
      trx,
    })
    return expense
  })
}
```

- [ ] **Step 5: Write the confirm tests**

`tests/functional/jobs/confirm.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import ProductionJob from '#models/production_job'
import { confirmJob, startJob } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('confirmJob', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('confirm from awaiting_confirmation completes job and frees printer', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ plannedQty: 1, withRecipe: false })
    const printer = await Printer.create({ name: 'C1', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 1 }],
      actor,
    })
    await ProductionJob.query()
      .where('id', job.id)
      .update({ status: 'awaiting_confirmation', auto_complete_at: null, current_stage_id: null })

    await confirmJob({ jobId: job.id, producedQty: 1, actor })

    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'completed')
    assert.equal(j.producedQty, 1)
    const p = await Printer.findOrFail(printer.id)
    assert.equal(p.status, 'idle')
    assert.isNull(p.currentJobId)
  })

  test('producedQty=0 routes to failJob', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'C2', status: 'idle' })
    await startJob({
      jobId: job.id,
      printerId: printer.id,
      stages: [{ name: 's', durationMinutes: 1 }],
      actor,
    })
    await ProductionJob.query()
      .where('id', job.id)
      .update({ status: 'awaiting_confirmation', auto_complete_at: null, current_stage_id: null })

    await confirmJob({ jobId: job.id, producedQty: 0, actor })

    const j = await ProductionJob.findOrFail(job.id)
    assert.equal(j.status, 'failed')
    const p = await Printer.findOrFail(printer.id)
    assert.equal(p.status, 'idle')
  })
})
```

- [ ] **Step 6: Write the printer-expense test**

`tests/functional/expenses/printer_expense.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import ProductionJob from '#models/production_job'
import { recordExpense } from '#services/job_costing'
import { setupJobFixture } from '#tests/helpers/job_fixtures'

test.group('expenses', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('printer-only expense does not change job totals', async ({ assert }) => {
    const { job, actor } = await setupJobFixture({ withRecipe: false })
    const printer = await Printer.create({ name: 'E1', status: 'idle' })
    const beforeTotal = (await ProductionJob.findOrFail(job.id)).totalExpense

    await recordExpense({
      printerId: printer.id,
      kind: 'maintenance',
      description: 'Replaced hotend',
      amount: 35,
      actor,
    })
    const afterTotal = (await ProductionJob.findOrFail(job.id)).totalExpense
    assert.equal(beforeTotal, afterTotal)
  })

  test('rejects expense with neither job nor printer', async ({ assert }) => {
    const { actor } = await setupJobFixture({ withRecipe: false })
    await assert.rejects(() =>
      recordExpense({ kind: 'other', description: 'x', amount: 1, actor })
    )
  })
})
```

- [ ] **Step 7: Run all new tests**

Run: `node ace test --files="tests/functional/jobs/confirm.spec.ts" --files="tests/functional/expenses/printer_expense.spec.ts"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/services/job_costing.ts tests/functional/jobs/confirm.spec.ts tests/functional/expenses/printer_expense.spec.ts
git commit -m "feat(jobs): confirmJob; free printer on terminal states; expenses can anchor to printers"
```

---

### Task 14: Purchase confirmation creates printer rows

**Files:**
- Modify: `app/services/purchase_service.ts`
- Modify: `app/services/inventory_service.ts` (short-circuit `applyMovement` for `item_kind='printer'`)
- Test: `tests/functional/printers/purchase_creates_printer.spec.ts`

- [ ] **Step 1: Short-circuit inventory for printers**

Open `app/services/inventory_service.ts`. Find `applyMovement`. At the very top of the function (before any DB writes), add:

```ts
if (input.itemKind === 'printer') {
  // Printers are not fungible stock; they exist as rows in `printers` instead.
  return
}
```

If `inventory_service.ts` already uses a union type that excludes `'printer'`, widen the parameter type to `'material' | 'component' | 'product' | 'printer'`.

- [ ] **Step 2: Modify `confirmPurchase`**

In `app/services/purchase_service.ts` `confirmPurchase`, change the for-loop:

```ts
for (const l of lines) {
  if (l.itemKind === 'printer') {
    const qty = Math.floor(Number(l.qty))
    for (let i = 0; i < qty; i++) {
      const printer = new Printer()
      printer.name = `${purchase.supplierId ? `Supplier-${purchase.supplierId}` : 'Printer'} #${purchase.id}-${l.id}-${i + 1}`
      printer.purchaseItemId = l.id
      printer.acquiredAt = DateTime.now()
      printer.status = 'idle'
      printer.useTransaction(trx)
      await printer.save()
    }
    continue
  }
  await applyMovement({ /* unchanged */ })
}
```

Add the import: `import Printer from '#models/printer'`.

- [ ] **Step 3: Write the test**

`tests/functional/printers/purchase_creates_printer.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Purchase from '#models/purchase'
import PurchaseItem from '#models/purchase_item'
import Printer from '#models/printer'
import User from '#models/user'
import { confirmPurchase } from '#services/purchase_service'

test.group('purchase confirmation creates printers', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a printer purchase line creates qty printer rows linked back', async ({ assert }) => {
    const actor = await User.create({
      email: `pt+${Date.now()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'P',
      lastName: 'T',
    })
    const purchase = await Purchase.create({
      number: `PO-${Date.now()}`,
      status: 'draft',
      supplierId: null,
      subtotal: '0',
      tax: '0',
      total: '0',
      createdByUserId: actor.id,
    } as any)
    const item = await PurchaseItem.create({
      purchaseId: purchase.id,
      itemKind: 'printer',
      itemId: 0,
      qty: '2',
      unitCost: '500',
      taxRatePct: '0',
      lineSubtotal: '1000',
      lineTax: '0',
      lineTotal: '1000',
    } as any)

    await confirmPurchase(purchase.id, actor)

    const printers = await Printer.query().where('purchase_item_id', item.id)
    assert.lengthOf(printers, 2)
    assert.equal(printers[0].status, 'idle')
  })
})
```

- [ ] **Step 4: Run the test**

Run: `node ace test --files="tests/functional/printers/purchase_creates_printer.spec.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/purchase_service.ts app/services/inventory_service.ts tests/functional/printers/purchase_creates_printer.spec.ts
git commit -m "feat(purchases): confirming a printer line creates printer rows"
```

---

### Task 15: `printer_service.ts` and `printers_view_models.ts`

**Files:**
- Create: `app/services/printer_service.ts`
- Create: `app/services/printers_view_models.ts`

- [ ] **Step 1: Create the service**

```ts
import db from '@adonisjs/lucid/services/db'
import Printer from '#models/printer'
import type User from '#models/user'
import { audit } from '#services/audit'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { DateTime } from 'luxon'

export async function createPrinter(input: {
  name: string
  model?: string | null
  serialNumber?: string | null
  notes?: string | null
  actor: User
}): Promise<Printer> {
  return db.transaction(async (trx) => {
    const exists = await Printer.query({ client: trx }).where('name', input.name).first()
    if (exists) throw new DomainError(`Printer "${input.name}" already exists.`)
    const printer = new Printer()
    printer.name = input.name
    printer.model = input.model ?? null
    printer.serialNumber = input.serialNumber ?? null
    printer.notes = input.notes ?? null
    printer.status = 'idle'
    printer.acquiredAt = DateTime.now()
    printer.useTransaction(trx)
    await printer.save()
    await audit({ actor: input.actor, action: 'printer.create', targetType: 'printer', targetId: printer.id, trx })
    return printer
  })
}

export async function updatePrinter(
  id: number,
  patch: { name?: string; model?: string | null; serialNumber?: string | null; notes?: string | null },
  actor: User
): Promise<Printer> {
  return db.transaction(async (trx) => {
    const printer = await Printer.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (patch.name !== undefined) printer.name = patch.name
    if (patch.model !== undefined) printer.model = patch.model
    if (patch.serialNumber !== undefined) printer.serialNumber = patch.serialNumber
    if (patch.notes !== undefined) printer.notes = patch.notes
    await printer.save()
    await audit({ actor, action: 'printer.update', targetType: 'printer', targetId: id, payload: patch, trx })
    return printer
  })
}

export async function retirePrinter(id: number, actor: User): Promise<Printer> {
  return db.transaction(async (trx) => {
    const printer = await Printer.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (printer.status === 'printing') {
      throw new InvalidStateError({ entity: 'printer', from: printer.status, to: 'retired' })
    }
    printer.status = 'retired'
    await printer.save()
    await audit({ actor, action: 'printer.retire', targetType: 'printer', targetId: id, trx })
    return printer
  })
}

export async function toggleMaintenance(id: number, actor: User): Promise<Printer> {
  return db.transaction(async (trx) => {
    const printer = await Printer.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (printer.status === 'printing' || printer.status === 'retired') {
      throw new InvalidStateError({ entity: 'printer', from: printer.status, to: 'maintenance' })
    }
    printer.status = printer.status === 'maintenance' ? 'idle' : 'maintenance'
    await printer.save()
    await audit({ actor, action: 'printer.toggle_maintenance', targetType: 'printer', targetId: id, payload: { newStatus: printer.status }, trx })
    return printer
  })
}
```

- [ ] **Step 2: Create the view models**

`app/services/printers_view_models.ts`:

```ts
import Printer from '#models/printer'
import PurchaseItem from '#models/purchase_item'
import Expense from '#models/expense'
import ProductionJob from '#models/production_job'
import db from '@adonisjs/lucid/services/db'

export async function getPrintersIndexViewModel() {
  const printers = await Printer.query().orderBy('name', 'asc')

  // Sum lifetime expenses per printer.
  const expenseSums = await db
    .from('expenses')
    .whereNotNull('printer_id')
    .groupBy('printer_id')
    .select('printer_id')
    .sum({ sum: 'amount' })
  const expensesById = new Map<number, number>()
  for (const row of expenseSums) {
    expensesById.set(Number(row.printer_id), Number(row.sum) || 0)
  }

  // Resolve purchase cost via purchase_item_id when present.
  const itemIds = printers.map((p) => p.purchaseItemId).filter((x): x is number => !!x)
  const items = itemIds.length
    ? await PurchaseItem.query().whereIn('id', itemIds)
    : []
  const itemById = new Map(items.map((i) => [i.id, i]))

  return {
    printers: printers.map((p) => {
      const item = p.purchaseItemId ? itemById.get(p.purchaseItemId) : null
      const purchaseCost = item ? Number(item.lineTotal) : 0
      const expenseTotal = expensesById.get(p.id) ?? 0
      return {
        id: p.id,
        name: p.name,
        model: p.model,
        status: p.status,
        currentJobId: p.currentJobId,
        purchaseCost: String(purchaseCost),
        expenseTotal: String(expenseTotal),
        totalSpent: String(purchaseCost + expenseTotal),
        acquiredAt: p.acquiredAt?.toISO() ?? null,
      }
    }),
  }
}

export async function getPrinterShowViewModel(id: number) {
  const printer = await Printer.findOrFail(id)
  const [jobs, expenses, item] = await Promise.all([
    ProductionJob.query()
      .where('printer_id', id)
      .orderBy('started_at', 'desc')
      .limit(50),
    Expense.query().where('printer_id', id).orderBy('incurred_at', 'desc'),
    printer.purchaseItemId ? PurchaseItem.find(printer.purchaseItemId) : null,
  ])
  const purchaseCost = item ? Number(item.lineTotal) : 0
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
  return {
    printer: {
      id: printer.id,
      name: printer.name,
      model: printer.model,
      serialNumber: printer.serialNumber,
      status: printer.status,
      currentJobId: printer.currentJobId,
      notes: printer.notes,
      acquiredAt: printer.acquiredAt?.toISO() ?? null,
      purchaseCost: String(purchaseCost),
      expenseTotal: String(expenseTotal),
      totalSpent: String(purchaseCost + expenseTotal),
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      number: j.number,
      status: j.status,
      startedAt: j.startedAt?.toISO() ?? null,
      completedAt: j.completedAt?.toISO() ?? null,
      totalCost: j.totalCost,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      kind: e.kind,
      description: e.description,
      amount: e.amount,
      incurredAt: e.incurredAt.toISO(),
    })),
  }
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add app/services/printer_service.ts app/services/printers_view_models.ts
git commit -m "feat(printers): service and view models"
```

---

## Phase 3 — HTTP Layer

### Task 16: Validators for printers

**Files:**
- Create: `app/validators/printers.ts`

- [ ] **Step 1: Create validators**

```ts
import vine from '@vinejs/vine'

export const createPrinterValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80),
    model: vine.string().trim().maxLength(80).optional(),
    serialNumber: vine.string().trim().maxLength(80).optional(),
    notes: vine.string().trim().maxLength(2000).optional(),
  })
)

export const updatePrinterValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80).optional(),
    model: vine.string().trim().maxLength(80).nullable().optional(),
    serialNumber: vine.string().trim().maxLength(80).nullable().optional(),
    notes: vine.string().trim().maxLength(2000).nullable().optional(),
  })
)

export const printerExpenseValidator = vine.compile(
  vine.object({
    kind: vine.enum(['maintenance', 'parts', 'addon', 'other']),
    description: vine.string().trim().minLength(1).maxLength(280),
    amount: vine.number().min(0.01).max(99_999_999_999),
    incurredAt: vine.date({ formats: { utc: true } }).optional(),
  })
)
```

- [ ] **Step 2: Commit**

```bash
git add app/validators/printers.ts
git commit -m "feat(validators): printer create/update/expense"
```

---

### Task 17: `PrintersController`

**Files:**
- Create: `app/controllers/printers_controller.ts`

- [ ] **Step 1: Implement**

```ts
import type { HttpContext } from '@adonisjs/core/http'
import {
  createPrinterValidator,
  printerExpenseValidator,
  updatePrinterValidator,
} from '#validators/printers'
import {
  createPrinter,
  retirePrinter,
  toggleMaintenance,
  updatePrinter,
} from '#services/printer_service'
import { recordExpense } from '#services/job_costing'
import { getPrinterShowViewModel, getPrintersIndexViewModel } from '#services/printers_view_models'
import { DomainError } from '#services/domain_errors'

export default class PrintersController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('printers.view' as never)
    const data = await getPrintersIndexViewModel()
    return inertia.render('printers/index', data)
  }

  async create({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('printers.create' as never)
    return inertia.render('printers/new')
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.create' as never)
    const payload = await request.validateUsing(createPrinterValidator)
    try {
      const printer = await createPrinter({ ...payload, actor: auth.user! })
      session.flash('success', `Printer "${printer.name}" added.`)
      return response.redirect().toPath(`/printers/${printer.id}`)
    } catch (err) {
      return this._domain(err, response, session)
    }
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('printers.view' as never)
    const data = await getPrinterShowViewModel(Number(params.id))
    return inertia.render('printers/show', data)
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.edit' as never)
    const payload = await request.validateUsing(updatePrinterValidator)
    try {
      await updatePrinter(Number(params.id), payload, auth.user!)
      session.flash('success', 'Printer updated.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async retire({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.retire' as never)
    try {
      await retirePrinter(Number(params.id), auth.user!)
      session.flash('success', 'Printer retired.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async toggleMaintenance({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.edit' as never)
    try {
      await toggleMaintenance(Number(params.id), auth.user!)
      session.flash('success', 'Printer maintenance state toggled.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async addExpense({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.edit' as never)
    const payload = await request.validateUsing(printerExpenseValidator)
    try {
      await recordExpense({
        printerId: Number(params.id),
        kind: payload.kind,
        description: payload.description,
        amount: payload.amount,
        incurredAt: payload.incurredAt ?? undefined,
        actor: auth.user!,
      })
      session.flash('success', 'Expense recorded.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  private _domain(
    err: unknown,
    response: HttpContext['response'],
    session: HttpContext['session']
  ) {
    if (err instanceof DomainError) {
      session.flash('error', err.message)
      return response.redirect().back()
    }
    throw err
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/controllers/printers_controller.ts
git commit -m "feat(controllers): PrintersController"
```

---

### Task 18: Update `JobsController` — `start`, `pause`, `resume`, `skipStage`, `confirm`

**Files:**
- Modify: `app/controllers/jobs_controller.ts`

- [ ] **Step 1: Update imports**

Replace the import block at the top of `app/controllers/jobs_controller.ts` with:

```ts
import type { HttpContext } from '@adonisjs/core/http'
import {
  addExpenseValidator,
  confirmJobValidator,
  consumeMaterialValidator,
  createJobValidator,
  failJobValidator,
  startJobValidator,
} from '#validators/jobs'
import { getJobShowViewModel, getJobsIndexViewModel } from '#services/jobs_view_models'
import {
  cancelJob,
  confirmJob,
  createJob,
  failJob,
  pauseJob,
  recordConsumption,
  recordExpense,
  resumeJob,
  skipStage,
  startJob,
} from '#services/job_costing'
import { DomainError } from '#services/domain_errors'
```

- [ ] **Step 2: Replace `start` method**

```ts
async start({ params, request, auth, bouncer, response, session }: HttpContext) {
  await bouncer.authorize('jobs.create' as never)
  const payload = await request.validateUsing(startJobValidator)
  try {
    await startJob({
      jobId: Number(params.id),
      printerId: payload.printerId,
      stages: payload.stages,
      actor: auth.user!,
    })
    session.flash('success', 'Job started.')
  } catch (err) {
    return this._domain(err, response, session)
  }
  return response.redirect().back()
}
```

- [ ] **Step 3: Add `pause`, `resume`, `skipStage`**

```ts
async pause({ params, auth, bouncer, response, session }: HttpContext) {
  await bouncer.authorize('jobs.create' as never)
  try {
    await pauseJob(Number(params.id), auth.user!)
    session.flash('success', 'Job paused.')
  } catch (err) {
    return this._domain(err, response, session)
  }
  return response.redirect().back()
}

async resume({ params, auth, bouncer, response, session }: HttpContext) {
  await bouncer.authorize('jobs.create' as never)
  try {
    await resumeJob(Number(params.id), auth.user!)
    session.flash('success', 'Job resumed.')
  } catch (err) {
    return this._domain(err, response, session)
  }
  return response.redirect().back()
}

async skipStage({ params, auth, bouncer, response, session }: HttpContext) {
  await bouncer.authorize('jobs.create' as never)
  try {
    await skipStage(Number(params.id), auth.user!)
    session.flash('success', 'Stage skipped.')
  } catch (err) {
    return this._domain(err, response, session)
  }
  return response.redirect().back()
}
```

- [ ] **Step 4: Replace `complete` with `confirm`**

Remove the existing `complete` method. Add:

```ts
async confirm({ params, request, auth, bouncer, response, session }: HttpContext) {
  await bouncer.authorize('jobs.complete' as never)
  const payload = await request.validateUsing(confirmJobValidator)
  try {
    await confirmJob({
      jobId: Number(params.id),
      producedQty: payload.producedQty,
      actor: auth.user!,
    })
    session.flash('success', 'Job confirmed.')
  } catch (err) {
    return this._domain(err, response, session)
  }
  return response.redirect().back()
}
```

- [ ] **Step 5: Commit**

```bash
git add app/controllers/jobs_controller.ts
git commit -m "feat(controllers): jobs gain pause/resume/skip/confirm; start takes printer+stages"
```

---

### Task 19: Routes

**Files:**
- Modify: `start/routes.ts`

- [ ] **Step 1: Add printer routes and update job routes**

In the `middleware.auth()` group, after the **Production jobs** section, replace the existing jobs block:

```ts
// ── Production jobs ───────────────────────────────────────────────
router.get('jobs', [JobsController, 'index']).as('jobs.index')
router.get('jobs/:id', [JobsController, 'show']).as('jobs.show')
router.post('jobs', [JobsController, 'store']).as('jobs.store')
router.post('jobs/:id/start', [JobsController, 'start']).as('jobs.start')
router.post('jobs/:id/pause', [JobsController, 'pause']).as('jobs.pause')
router.post('jobs/:id/resume', [JobsController, 'resume']).as('jobs.resume')
router.post('jobs/:id/skip-stage', [JobsController, 'skipStage']).as('jobs.skip_stage')
router.post('jobs/:id/consumptions', [JobsController, 'consume']).as('jobs.consume')
router.post('jobs/:id/expenses', [JobsController, 'addExpense']).as('jobs.expense')
router.post('jobs/:id/confirm', [JobsController, 'confirm']).as('jobs.confirm')
router.post('jobs/:id/fail', [JobsController, 'fail']).as('jobs.fail')
router.post('jobs/:id/cancel', [JobsController, 'cancel']).as('jobs.cancel')

// ── Printers ──────────────────────────────────────────────────────
router.get('printers', [PrintersController, 'index']).as('printers.index')
router.get('printers/new', [PrintersController, 'create']).as('printers.new')
router.post('printers', [PrintersController, 'store']).as('printers.store')
router.get('printers/:id', [PrintersController, 'show']).as('printers.show')
router.post('printers/:id', [PrintersController, 'update']).as('printers.update')
router.post('printers/:id/retire', [PrintersController, 'retire']).as('printers.retire')
router
  .post('printers/:id/maintenance', [PrintersController, 'toggleMaintenance'])
  .as('printers.maintenance')
router.post('printers/:id/expense', [PrintersController, 'addExpense']).as('printers.expense')
```

At the top with other controller imports add:

```ts
const PrintersController = () => import('#controllers/printers_controller')
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add start/routes.ts
git commit -m "feat(routes): printer routes; jobs pause/resume/skip/confirm"
```

---

### Task 20: Extend `getJobShowViewModel` and `getJobsIndexViewModel`

**Files:**
- Modify: `app/services/jobs_view_models.ts`

- [ ] **Step 1: Add stages and printer fields to the show view model**

In `getJobShowViewModel`, add loads and include in the return:

```ts
import Printer from '#models/printer'
import ProductionJobStage from '#models/production_job_stage'

// inside Promise.all in getJobShowViewModel, append:
//   ProductionJobStage.query().where('job_id', jobId).orderBy('sequence', 'asc'),
//   job.printerId ? Printer.find(job.printerId) : Promise.resolve(null)
// and destructure printerRow, stages from the resulting tuple.

// In the returned `job` object, add:
printerId: job.printerId,
printerName: printerRow?.name ?? null,
autoCompleteAt: job.autoCompleteAt?.toISO() ?? null,
estimatedDurationMin: job.estimatedDurationMin,
pausedAt: job.pausedAt?.toISO() ?? null,
remainingSeconds: job.remainingSeconds,
currentStageId: job.currentStageId,

// Also include at the top level:
stages: stages.map((s) => ({
  id: s.id,
  sequence: s.sequence,
  name: s.name,
  estimatedDurationMin: s.estimatedDurationMin,
  status: s.status,
  startedAt: s.startedAt?.toISO() ?? null,
  completedAt: s.completedAt?.toISO() ?? null,
  autoCompleteAt: s.autoCompleteAt?.toISO() ?? null,
})),
```

In `getJobsIndexViewModel`, add to the per-row mapping:

```ts
printerId: j.printerId,
autoCompleteAt: j.autoCompleteAt?.toISO() ?? null,
```

- [ ] **Step 2: Commit**

```bash
git add app/services/jobs_view_models.ts
git commit -m "feat(view-models): expose printer, stages, timer fields to jobs UI"
```

---

## Phase 4 — Frontend

### Task 21: `JobCountdown` component

**Files:**
- Create: `inertia/components/jobs/job-countdown.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react'

interface Props {
  autoCompleteAt: string | null
  remainingSeconds: number | null
  paused: boolean
}

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function JobCountdown({ autoCompleteAt, remainingSeconds, paused }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (paused || !autoCompleteAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused, autoCompleteAt])

  if (paused && remainingSeconds !== null) {
    return <span className="font-mono">Paused — {fmt(remainingSeconds)} left</span>
  }
  if (!autoCompleteAt) {
    return <span className="text-muted-foreground">—</span>
  }
  const remaining = (new Date(autoCompleteAt).getTime() - now) / 1000
  if (remaining <= 0) {
    return <span className="font-mono text-amber-600">Awaiting confirmation</span>
  }
  return <span className="font-mono">{fmt(remaining)}</span>
}
```

- [ ] **Step 2: Commit**

```bash
git add inertia/components/jobs/job-countdown.tsx
git commit -m "feat(ui): JobCountdown component"
```

---

### Task 22: `JobStagesList` and `JobStagesRepeater`

**Files:**
- Create: `inertia/components/jobs/job-stages-list.tsx`
- Create: `inertia/components/jobs/job-stages-repeater.tsx`

- [ ] **Step 1: Stages list (read-only display on job show)**

```tsx
import { Badge } from '@/components/ui/badge'
import { JobCountdown } from './job-countdown'

export interface StageView {
  id: number
  sequence: number
  name: string
  estimatedDurationMin: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  autoCompleteAt: string | null
}

export function JobStagesList({
  stages,
  paused,
  remainingSeconds,
}: {
  stages: StageView[]
  paused: boolean
  remainingSeconds: number | null
}) {
  return (
    <ol className="space-y-2">
      {stages.map((s) => (
        <li key={s.id} className="flex items-center justify-between rounded border p-3">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-sm">{s.sequence}.</span>
            <span className="font-medium">{s.name}</span>
            <Badge variant={badgeVariant(s.status)}>{s.status}</Badge>
            <span className="text-muted-foreground text-sm">{s.estimatedDurationMin} min</span>
          </div>
          {s.status === 'in_progress' ? (
            <JobCountdown
              autoCompleteAt={s.autoCompleteAt}
              remainingSeconds={remainingSeconds}
              paused={paused}
            />
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function badgeVariant(s: StageView['status']) {
  if (s === 'completed') return 'default' as const
  if (s === 'in_progress') return 'secondary' as const
  if (s === 'skipped') return 'outline' as const
  return 'outline' as const
}
```

- [ ] **Step 2: Stages repeater (start form)**

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus } from 'lucide-react'

export interface StageDraft {
  name: string
  durationMinutes: number
}

export function JobStagesRepeater({
  value,
  onChange,
}: {
  value: StageDraft[]
  onChange: (next: StageDraft[]) => void
}) {
  const update = (i: number, patch: Partial<StageDraft>) => {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const add = () => onChange([...value, { name: `Stage ${value.length + 1}`, durationMinutes: 30 }])

  return (
    <div className="space-y-2">
      <Label>Stages</Label>
      {value.map((row, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Stage name"
            />
          </div>
          <div className="w-32">
            <Input
              type="number"
              min={1}
              value={row.durationMinutes}
              onChange={(e) => update(i, { durationMinutes: Number(e.target.value) || 0 })}
              placeholder="Minutes"
            />
          </div>
          {value.length > 1 ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" /> Add stage
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add inertia/components/jobs/job-stages-list.tsx inertia/components/jobs/job-stages-repeater.tsx
git commit -m "feat(ui): stage list and stage repeater components"
```

---

### Task 23: Update `inertia/pages/jobs/show.tsx`

**Files:**
- Modify: `inertia/pages/jobs/show.tsx`

The exact form of this page depends on how the existing one is structured; the engineer should read it before editing. Apply these changes:

- [ ] **Step 1: Read the current `jobs/show.tsx`**

Run: `cat inertia/pages/jobs/show.tsx | head -120`

- [ ] **Step 2: Wire in new data**

- Accept new prop fields on the `job` object: `printerId`, `printerName`, `autoCompleteAt`, `pausedAt`, `remainingSeconds`, `currentStageId`, plus a top-level `stages` array (shape from Task 22's `StageView`).
- Below the existing job header card, render `<JobStagesList stages={stages} paused={!!job.pausedAt} remainingSeconds={job.remainingSeconds} />`.
- Add an action bar above the existing controls. Visibility rules:

```tsx
import { Link, router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'

function StatusActions({ job }: { job: JobShow['job'] }) {
  const post = (path: string) => router.post(path, {}, { preserveScroll: true })
  if (job.status === 'in_progress') {
    return (
      <div className="flex gap-2">
        <Button onClick={() => post(`/jobs/${job.id}/pause`)}>Pause</Button>
        <Button variant="outline" onClick={() => post(`/jobs/${job.id}/skip-stage`)}>
          Skip stage
        </Button>
        <Button variant="destructive" onClick={() => post(`/jobs/${job.id}/fail`)}>
          Mark failed
        </Button>
      </div>
    )
  }
  if (job.status === 'paused') {
    return (
      <div className="flex gap-2">
        <Button onClick={() => post(`/jobs/${job.id}/resume`)}>Resume</Button>
        <Button variant="outline" onClick={() => post(`/jobs/${job.id}/skip-stage`)}>
          Skip stage
        </Button>
        <Button variant="destructive" onClick={() => post(`/jobs/${job.id}/fail`)}>
          Mark failed
        </Button>
      </div>
    )
  }
  return null
}
```

- For `status === 'awaiting_confirmation'` render a prominent card with a `producedQty` input (defaulting to `plannedQty`) that POSTs to `/jobs/:id/confirm`, plus a "Mark failed" button.

- For the **Start** action (only shown when `status==='draft'`), open a modal or section that uses `JobStagesRepeater` and a printer select (loaded from a new server-supplied `idlePrinters` array — see Step 3) and POSTs to `/jobs/:id/start` with the payload `{ printerId, stages: [...] }`.

- [ ] **Step 3: Provide `idlePrinters` to the page**

In `getJobShowViewModel`, also load:

```ts
import Printer from '#models/printer'
// ...
const idlePrinters = await Printer.query().where('status', 'idle').orderBy('name', 'asc')

// include in return:
idlePrinters: idlePrinters.map((p) => ({ id: p.id, name: p.name })),
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. In a browser, create a draft job, start it with two stages on an idle printer, pause/resume, then force the timer to elapse (set `auto_complete_at` to the past via a SQL update) and confirm the UI flips to "Awaiting confirmation" within ~30s of the scheduler tick.

- [ ] **Step 5: Commit**

```bash
git add inertia/pages/jobs/show.tsx app/services/jobs_view_models.ts
git commit -m "feat(ui): jobs show with stages, countdown, pause/resume/skip/confirm"
```

---

### Task 24: Printer index, new, and show pages

**Files:**
- Create: `inertia/pages/printers/index.tsx`
- Create: `inertia/pages/printers/new.tsx`
- Create: `inertia/pages/printers/show.tsx`

- [ ] **Step 1: `printers/index.tsx`**

```tsx
import { Head, Link, usePage } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PrinterRow {
  id: number
  name: string
  model: string | null
  status: 'idle' | 'printing' | 'maintenance' | 'offline' | 'retired'
  currentJobId: number | null
  totalSpent: string
}

export default function PrintersIndex() {
  const { props } = usePage<{ printers: PrinterRow[] }>()
  return (
    <>
      <Head title="Printers" />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Printers</h1>
        <Link href="/printers/new">
          <Button>Add printer</Button>
        </Link>
      </div>
      <div className="rounded border">
        <table className="w-full">
          <thead className="border-b text-left text-sm text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Model</th>
              <th className="p-3">Status</th>
              <th className="p-3">Current job</th>
              <th className="p-3 text-right">Total spent</th>
            </tr>
          </thead>
          <tbody>
            {props.printers.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-3">
                  <Link href={`/printers/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{p.model ?? '—'}</td>
                <td className="p-3">
                  <Badge variant={p.status === 'idle' ? 'default' : 'secondary'}>{p.status}</Badge>
                </td>
                <td className="p-3">
                  {p.currentJobId ? (
                    <Link href={`/jobs/${p.currentJobId}`} className="hover:underline">
                      Job #{p.currentJobId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-right font-mono">{p.totalSpent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
```

- [ ] **Step 2: `printers/new.tsx`**

```tsx
import { Head, useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function PrinterNew() {
  const form = useForm({ name: '', model: '', serialNumber: '', notes: '' })
  return (
    <>
      <Head title="Add printer" />
      <h1 className="mb-4 text-2xl font-semibold">Add printer</h1>
      <form
        className="max-w-lg space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.post('/printers')
        }}
      >
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.data.name}
            onChange={(e) => form.setData('name', e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={form.data.model}
            onChange={(e) => form.setData('model', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="serialNumber">Serial number</Label>
          <Input
            id="serialNumber"
            value={form.data.serialNumber}
            onChange={(e) => form.setData('serialNumber', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.data.notes}
            onChange={(e) => form.setData('notes', e.target.value)}
          />
        </div>
        <Button type="submit" disabled={form.processing}>
          Add printer
        </Button>
      </form>
    </>
  )
}
```

- [ ] **Step 3: `printers/show.tsx`**

```tsx
import { Head, Link, router, useForm, usePage } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PrinterDetail {
  id: number
  name: string
  model: string | null
  serialNumber: string | null
  status: string
  currentJobId: number | null
  notes: string | null
  acquiredAt: string | null
  purchaseCost: string
  expenseTotal: string
  totalSpent: string
}
interface JobRow {
  id: number
  number: string
  status: string
  startedAt: string | null
  completedAt: string | null
  totalCost: string
}
interface ExpenseRow {
  id: number
  kind: string
  description: string
  amount: string
  incurredAt: string
}

export default function PrinterShow() {
  const { props } = usePage<{ printer: PrinterDetail; jobs: JobRow[]; expenses: ExpenseRow[] }>()
  const { printer, jobs, expenses } = props
  const form = useForm({ kind: 'maintenance', description: '', amount: 0 })

  return (
    <>
      <Head title={printer.name} />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{printer.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge>{printer.status}</Badge>
            <span>{printer.model ?? '—'}</span>
            <span>SN: {printer.serialNumber ?? '—'}</span>
            <span>Total spent: {printer.totalSpent}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {printer.status !== 'retired' ? (
            <Button
              variant="outline"
              onClick={() => router.post(`/printers/${printer.id}/maintenance`)}
            >
              {printer.status === 'maintenance' ? 'End maintenance' : 'Start maintenance'}
            </Button>
          ) : null}
          {printer.status !== 'retired' ? (
            <Button
              variant="destructive"
              onClick={() => router.post(`/printers/${printer.id}/retire`)}
            >
              Retire
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-medium">Job history</h2>
        <div className="rounded border">
          <table className="w-full">
            <thead className="border-b text-left text-sm text-muted-foreground">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Status</th>
                <th className="p-3">Started</th>
                <th className="p-3">Completed</th>
                <th className="p-3 text-right">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Link href={`/jobs/${j.id}`} className="hover:underline">
                      {j.number}
                    </Link>
                  </td>
                  <td className="p-3">{j.status}</td>
                  <td className="p-3 text-muted-foreground">{j.startedAt ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{j.completedAt ?? '—'}</td>
                  <td className="p-3 text-right font-mono">{j.totalCost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Expenses</h2>
        <form
          className="mb-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            form.post(`/printers/${printer.id}/expense`)
          }}
        >
          <div className="w-40">
            <Label>Kind</Label>
            <Select value={form.data.kind} onValueChange={(v) => form.setData('kind', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="parts">Parts</SelectItem>
                <SelectItem value="addon">Add-on</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>Description</Label>
            <Input
              value={form.data.description}
              onChange={(e) => form.setData('description', e.target.value)}
              required
            />
          </div>
          <div className="w-32">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min={0.01}
              value={form.data.amount}
              onChange={(e) => form.setData('amount', Number(e.target.value))}
              required
            />
          </div>
          <Button type="submit" disabled={form.processing}>
            Add
          </Button>
        </form>
        <div className="rounded border">
          <table className="w-full">
            <thead className="border-b text-left text-sm text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Kind</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-3 text-muted-foreground">{e.incurredAt}</td>
                  <td className="p-3">{e.kind}</td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3 text-right font-mono">{e.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Navigate to `/printers`, create one, open it, add a maintenance expense.

- [ ] **Step 5: Commit**

```bash
git add inertia/pages/printers
git commit -m "feat(ui): printers index/new/show pages"
```

---

### Task 25: Link printers from `purchases/show.tsx`

**Files:**
- Modify: `inertia/pages/purchases/show.tsx`
- Modify: `app/services/purchases_view_models.ts` (load created printer rows per line)

- [ ] **Step 1: Provide created-printers per line**

In the existing purchases show view model, after loading `items`, also load printers grouped by `purchase_item_id`:

```ts
import Printer from '#models/printer'
// ...
const printerIds = items.map((i) => i.id)
const printers = printerIds.length
  ? await Printer.query().whereIn('purchase_item_id', printerIds)
  : []
const printersByItem = new Map<number, Array<{ id: number; name: string }>>()
for (const p of printers) {
  if (!p.purchaseItemId) continue
  const arr = printersByItem.get(p.purchaseItemId) ?? []
  arr.push({ id: p.id, name: p.name })
  printersByItem.set(p.purchaseItemId, arr)
}

// In the returned items array, attach:
printers: printersByItem.get(item.id) ?? [],
```

- [ ] **Step 2: Render in the page**

In `inertia/pages/purchases/show.tsx`, in the line-items section, when a line's `itemKind === 'printer'` render the linked printer names:

```tsx
{line.itemKind === 'printer' && line.printers?.length ? (
  <div className="mt-1 text-xs text-muted-foreground">
    Printers created:{' '}
    {line.printers.map((p, i) => (
      <span key={p.id}>
        {i > 0 ? ', ' : ''}
        <Link href={`/printers/${p.id}`} className="hover:underline">
          {p.name}
        </Link>
      </span>
    ))}
  </div>
) : null}
```

- [ ] **Step 3: Commit**

```bash
git add app/services/purchases_view_models.ts inertia/pages/purchases/show.tsx
git commit -m "feat(ui): purchase lines link to created printers"
```

---

### Task 26: Printer index test

**Files:**
- Test: `tests/functional/printers/index.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Printer from '#models/printer'
import Expense from '#models/expense'
import User from '#models/user'
import { getPrintersIndexViewModel } from '#services/printers_view_models'

test.group('printers index view model', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('aggregates expense total per printer', async ({ assert }) => {
    const user = await User.create({
      email: `idx+${Date.now()}@example.com`,
      password: 'Passw0rd!',
      firstName: 'I',
      lastName: 'X',
    })
    const p = await Printer.create({ name: 'AGG-1', status: 'idle' })
    await Expense.create({
      printerId: p.id,
      jobId: null,
      kind: 'maintenance',
      description: 'fan',
      amount: '12.50',
      incurredAt: new Date() as any,
      createdByUserId: user.id,
    } as any)
    await Expense.create({
      printerId: p.id,
      jobId: null,
      kind: 'parts',
      description: 'bearing',
      amount: '7.50',
      incurredAt: new Date() as any,
      createdByUserId: user.id,
    } as any)

    const vm = await getPrintersIndexViewModel()
    const row = vm.printers.find((r) => r.id === p.id)
    assert.equal(row?.expenseTotal, '20')
  })
})
```

- [ ] **Step 2: Run and commit**

Run: `node ace test --files="tests/functional/printers/index.spec.ts"`
Expected: PASS.

```bash
git add tests/functional/printers/index.spec.ts
git commit -m "test(printers): index view model aggregates expenses"
```

---

## Phase 5 — Final verification

### Task 27: Full suite + lint + typecheck

- [ ] **Step 1: Run everything**

```bash
npm run lint && npm run typecheck && npm test
```
Expected: all green. If anything fails, fix the root cause before continuing.

- [ ] **Step 2: Commit any lint/format fixups**

```bash
npm run format
git add -A
git diff --cached --stat
git commit -m "chore: lint/format pass" || echo "nothing to commit"
```

- [ ] **Step 3: Manual end-to-end smoke**

Run: `SCHEDULER_ENABLED=true npm run dev`. Walk through the golden path in the browser:

1. Create a printer manually at `/printers/new`.
2. Create a draft job at `/jobs`, then start it with two stages of 1 minute each on the printer.
3. Watch the countdown component tick. Pause and resume; observe the timer freezes and resumes.
4. Wait (or `UPDATE production_jobs SET auto_complete_at = NOW() - interval '1 minute' WHERE id = ...`) for the scheduler tick to advance stages and finally move the job to `awaiting_confirmation`.
5. Confirm with `producedQty = plannedQty`. Verify the printer goes back to `idle` and inventory of the product increased.
6. Add a maintenance expense to the printer; verify it does not change the job totals.
7. Create a purchase with one line `item_kind='printer'`, `qty=2`. Confirm it; verify two printer rows are created and shown on the purchase page.

- [ ] **Step 4: Final commit (if needed)**

If smoke-test fixes are needed, add focused commits. Otherwise no action.

---

## Self-Review Notes

**Spec coverage check (cross-referenced against `2026-05-19-job-timer-and-printers-design.md`):**

- Migrations 1–5 → Tasks 1, 3, 4, 5, 7. ✓
- `printers` model + relations → Task 2; `expense` model → Task 6; `production_job_stage` model → Task 7. ✓
- `startJob` extension → Task 9; `pauseJob`/`resumeJob` → Task 10; `skipStage` + advance helper → Task 11; scheduler tick → Task 12; `confirmJob`/`failJob`/`cancelJob`/`recordExpense` → Task 13. ✓
- Purchase confirmation printer creation → Task 14. ✓
- `printer_service` and view models → Task 15. ✓
- Validators → Tasks 9 and 16. ✓
- Controllers → Tasks 17 and 18. ✓
- Routes → Task 19. ✓
- View-model additions on `jobs_view_models.ts` → Task 20 and (`idlePrinters`) Task 23. ✓
- `JobCountdown`, stages list, stages repeater → Tasks 21, 22. ✓
- Jobs show page changes → Task 23. ✓
- Printers index/new/show pages → Task 24. ✓
- Purchases page link to printers → Task 25. ✓
- Tests required by spec:
  - `unit/services/scheduler_eligible_jobs.spec.ts` → Task 12. ✓
  - `unit/services/stage_advance.spec.ts` → Task 8. ✓
  - `functional/jobs/start_with_printer.spec.ts` → Task 9. ✓
  - `functional/jobs/auto_complete.spec.ts` → Task 12. ✓
  - `functional/jobs/multi_stage.spec.ts` → Task 12. ✓
  - `functional/jobs/pause_resume.spec.ts` → Task 10. ✓
  - `functional/jobs/confirm.spec.ts` → Task 13. ✓
  - `functional/printers/index.spec.ts` → Task 26. ✓
  - `functional/printers/purchase_creates_printer.spec.ts` → Task 14. ✓
  - `functional/expenses/printer_expense.spec.ts` → Task 13. ✓

**Naming consistency check:**

- `startJob({ jobId, printerId, stages, actor })` → consistent through controller, tests, service.
- `pauseJob(id, actor)`, `resumeJob(id, actor)`, `skipStage(id, actor)` → consistent.
- `confirmJob({ jobId, producedQty, actor })` → consistent.
- `recordExpense({ jobId?, printerId?, ... })` → consistent; both anchors optional but at least one required (DB CHECK + service check).
- `nextStage(stages, finishedSequence)` and `advanceStageOrAwaitConfirmation(...)` → both used in the same files; signatures match.
- Database columns: `auto_complete_at`, `current_stage_id`, `paused_at`, `remaining_seconds` → match Lucid-camel attribute names `autoCompleteAt`, `currentStageId`, `pausedAt`, `remainingSeconds`.

**Placeholder check:** no TBDs, no "see above", no "add appropriate error handling" — all error paths show explicit `InvalidStateError` / `DomainError` constructions.
