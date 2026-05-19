# Job Timer, Multi-Stage Prints, and Printer Resources — Design

Date: 2026-05-19
Status: Draft for review

## Summary

Two related features for the production-job workflow:

1. **Job timer with multi-stage support and pause/resume.** Each job is assigned a duration broken into one or more sequential stages. A backend scheduler advances stages automatically and, when the final stage's timer expires, moves the job to a new `awaiting_confirmation` state. A human still confirms the produced quantity before stock is credited.
2. **3D printers as a managed resource.** A new `printers` table represents physical machines. Jobs are assigned to a printer at start time; a partial unique index guarantees a printer runs at most one active job. Printers are created either manually or as a side-effect of confirming a purchase line of kind `'printer'`. Maintenance, repair, and addon costs are tracked via a generalized `expenses` table (renamed from `job_expenses`) that can anchor to a job, a printer, or both.

Both features land together because the printer model and the timer share the same start/complete lifecycle.

## Non-Goals

- Direct printer integration (OctoPrint, Klipper, MQTT, etc.).
- Push notifications when a timer expires; in-app polling is sufficient for v1.
- Tracking spare parts as a printer-specific inventory pool. Parts go through purchases as materials, or are booked as a printer expense.
- Reassigning a job from one printer to another mid-print.
- Per-stage material consumption. Recipe auto-consume still runs once at job start.

## Data Model

### Migration 1 — `printers` table

```
printers
  id                 serial primary key
  name               varchar not null unique
  model              varchar nullable
  serial_number      varchar nullable
  status             varchar not null default 'idle'
                     -- 'idle' | 'printing' | 'maintenance' | 'offline' | 'retired'
  current_job_id     integer nullable
                     references production_jobs(id) on delete set null
  purchase_item_id   integer nullable
                     references purchase_items(id) on delete set null
  acquired_at        timestamptz nullable
  notes              text nullable
  created_at, updated_at
```

Indexes:

- `UNIQUE (current_job_id) WHERE current_job_id IS NOT NULL` — DB-level guarantee that a printer holds at most one job reference.
- `INDEX (status)` for the idle-printer dropdown queries.

### Migration 2 — `production_jobs` additions

```
ALTER TABLE production_jobs
  ADD COLUMN printer_id              integer nullable
    references printers(id) on delete restrict,
  ADD COLUMN estimated_duration_min  integer nullable,
  ADD COLUMN auto_complete_at        timestamptz nullable,
  ADD COLUMN current_stage_id        integer nullable,  -- FK added in migration 5
  ADD COLUMN paused_at               timestamptz nullable,
  ADD COLUMN remaining_seconds       integer nullable;
```

Status enum extended with `'paused'` and `'awaiting_confirmation'`. Status is a free-form `varchar` today (see existing migration `1778000000110`), so no enum-type migration is required — the application validates.

Partial unique index:

```
CREATE UNIQUE INDEX production_jobs_active_printer_uidx
ON production_jobs (printer_id)
WHERE status IN ('in_progress', 'paused', 'awaiting_confirmation');
```

`auto_complete_at` and `estimated_duration_min` describe the **current active stage**, not the whole job. For single-stage jobs this is functionally identical to "the whole job".

### Migration 3 — rename `job_expenses` to `expenses`

```
ALTER TABLE job_expenses RENAME TO expenses;
ALTER TABLE expenses
  ALTER COLUMN job_id DROP NOT NULL,
  ADD COLUMN printer_id integer nullable
    references printers(id) on delete restrict,
  ADD CONSTRAINT expenses_anchor_chk
    CHECK (job_id IS NOT NULL OR printer_id IS NOT NULL);
CREATE INDEX expenses_printer_id_idx ON expenses (printer_id);
```

The existing `kind` column already accepts free strings; the application layer adds `'maintenance' | 'parts' | 'addon'` to the allowed set for new expenses.

`#models/job_expense.ts` is renamed to `#models/expense.ts`. `#models/production_job.ts` updates its `hasMany` decorator accordingly. Service references update.

### Migration 4 — `purchase_items.item_kind` accepts `'printer'`

No schema change beyond an application-level CHECK extension: the existing column is a free `varchar`. Add a DB constraint that when `item_kind='printer'`, `qty` is a positive integer:

```
ALTER TABLE purchase_items
  ADD CONSTRAINT purchase_items_printer_qty_int_chk
  CHECK (item_kind <> 'printer' OR (qty = floor(qty) AND qty >= 1));
```

Printer purchase lines do **not** enter the `inventory` table — `applyMovement` in `inventory_service` is short-circuited for `item_kind='printer'`. Cost lives on `purchase_items` and propagates to printer TCO via a join, not via inventory.

### Migration 5 — `production_job_stages` table

```
production_job_stages
  id                       serial primary key
  job_id                   integer not null
                           references production_jobs(id) on delete cascade
  sequence                 integer not null
  name                     varchar not null
  estimated_duration_min   integer not null
  status                   varchar not null default 'pending'
                           -- 'pending' | 'in_progress' | 'completed' | 'skipped'
  started_at               timestamptz nullable
  completed_at             timestamptz nullable
  auto_complete_at         timestamptz nullable
  created_at, updated_at
  UNIQUE (job_id, sequence)
  INDEX (job_id, status)
```

Migration 5 also adds the deferred FK:

```
ALTER TABLE production_jobs
  ADD CONSTRAINT production_jobs_current_stage_fk
  FOREIGN KEY (current_stage_id)
  REFERENCES production_job_stages(id)
  ON DELETE SET NULL;
```

## State Machine

```
draft ─► in_progress ◄──► paused ─► awaiting_confirmation ─► completed
   │           │            │             │                       │
   │           └─► failed   └─► failed    └─► failed              │
   └─► cancelled                                                  ▼
                                                                done
```

Allowed transitions and the function that performs them:

| From                        | To                       | Function           |
|-----------------------------|--------------------------|--------------------|
| `draft`                     | `in_progress`            | `startJob`         |
| `draft`                     | `cancelled`              | `cancelJob`        |
| `in_progress`               | `paused`                 | `pauseJob`         |
| `paused`                    | `in_progress`            | `resumeJob`        |
| `in_progress`               | `awaiting_confirmation`  | scheduler tick     |
| `in_progress` / `paused`    | `failed`                 | `failJob`          |
| `in_progress` / `paused`    | `completed`              | `confirmJob`       |
| `awaiting_confirmation`     | `completed`              | `confirmJob`       |
| `awaiting_confirmation`     | `failed`                 | `failJob`          |

Printer-locking rule: a printer is held from `startJob` until the job leaves `in_progress` / `paused` / `awaiting_confirmation`. The partial unique index enforces this even under race conditions.

## Services

All services live in `app/services/`. New file: `job_auto_complete_scheduler.ts`. Modifications to `job_costing.ts`, `inventory_service.ts`, `purchases_service.ts` (or equivalent confirmation path).

### `startJob(jobId, printerId, stages, actor)`

`stages` is `Array<{ name: string; durationMinutes: number }>` with length ≥ 1. If a caller passes a single `durationMinutes` (legacy / simple case), it is wrapped into one stage named `"Print"`.

1. Open transaction.
2. Lock the job (`FOR UPDATE`); require `status='draft'`.
3. Lock the printer (`FOR UPDATE`); require `status='idle'`.
4. Insert all stages with `status='pending'`, sequenced 1..N.
5. Activate stage 1: set `started_at=now()`, `auto_complete_at=now()+duration`, `status='in_progress'`.
6. Mirror onto the job: `printer_id`, `current_stage_id`, `auto_complete_at`, `estimated_duration_min`, `started_at=now()`, `status='in_progress'`.
7. Set printer `status='printing'`, `current_job_id=job.id`.
8. Recipe auto-consume (existing logic, unchanged).
9. Audit `job.start` with `{ printerId, stages }`.

### Scheduler tick — `job_auto_complete_scheduler.ts`

Runs every 30 seconds via a long-lived `setInterval` started by a provider's `ready()` hook. Guarded by env var `SCHEDULER_ENABLED=true` so only the primary process runs it (worker / migration / test processes set it to false).

Each tick:

```sql
SELECT id FROM production_jobs
WHERE status = 'in_progress'
  AND auto_complete_at <= NOW()
ORDER BY auto_complete_at
FOR UPDATE SKIP LOCKED
LIMIT 50;
```

For each id, in its own transaction:

1. Re-fetch the job and its current stage.
2. Mark the stage `completed`, set `completed_at=now()`.
3. If a next stage (by sequence) exists in `pending`:
   - Activate it: `status='in_progress'`, `started_at=now()`, `auto_complete_at=now()+duration`.
   - Update the job: `current_stage_id`, `auto_complete_at`, `estimated_duration_min`.
   - Audit `job.stage_advance`.
4. Else:
   - Job `status='awaiting_confirmation'`, `auto_complete_at=null`, `current_stage_id=null`.
   - Audit `job.auto_timer_expired`.

`SKIP LOCKED` makes the tick safe against overlapping runs and against a user manually pausing the same job at the same moment.

### `pauseJob(jobId, actor)`

1. Lock job, require `status='in_progress'`.
2. `remaining_seconds = max(0, ceil((auto_complete_at - now()) / 1000))`.
3. Job: `status='paused'`, `paused_at=now()`, `remaining_seconds=…`, `auto_complete_at=null`.
4. Current stage: clear `auto_complete_at` (keeps `started_at`).
5. Printer unchanged. Audit `job.pause`.

### `resumeJob(jobId, actor)`

1. Lock job, require `status='paused'`.
2. New deadline: `auto_complete_at = now() + remaining_seconds`.
3. Job: `status='in_progress'`, clear `paused_at`, clear `remaining_seconds`.
4. Current stage: `auto_complete_at = job.auto_complete_at`.
5. Audit `job.resume`.

### `skipStage(jobId, actor)`

1. Lock job, require `status in ('in_progress','paused')` and a `current_stage_id`.
2. Mark current stage `skipped` (and `completed_at=now()`).
3. Run the same "advance next stage or finish" logic as the scheduler tick.
4. Audit `job.stage_skip` with `{ skipped: stage.sequence }`.

### `confirmJob(jobId, producedQty, actor)`

Replaces the publicly exposed `completeJob` from the existing controller — the existing function is kept as the internal completion routine.

1. Lock job, require `status in ('in_progress','paused','awaiting_confirmation')`.
2. If `producedQty <= 0` → delegate to `failJob` with reason `"confirmed zero output"`.
3. Else run the existing completion logic: recompute totals, credit inventory at unit cost, update product recipe.
4. Free the printer: `printer.status='idle'`, `current_job_id=null`.
5. Audit `job.confirm`.

### `failJob` / `cancelJob`

Existing functions extended to free the printer on the way out. `failJob` is now reachable from `paused` and `awaiting_confirmation` as well as `in_progress`.

### `recordExpense(input)`

Now accepts `jobId?` and `printerId?`; at least one is required. If `printerId` is set but `jobId` is null, `recomputeJobTotals` is skipped. The audit event is `expense.create` with both ids in payload.

### Purchase confirmation — printer side-effect

In the existing purchase-confirm flow, after inventory movements:

```
for each purchase_item where item_kind = 'printer':
  for i in 1..qty:
    create printers row:
      name             = `${supplier.name ?? 'Printer'} #${nextSeq()}`  -- user renames after
      purchase_item_id = purchase_item.id
      acquired_at      = purchase.confirmed_at
      status           = 'idle'
```

The printer's "cost basis" is reported by joining through `purchase_item_id` to `purchase_items.unit_cost + tax / qty`; not denormalized.

## Routes

```
GET    /printers
GET    /printers/new
POST   /printers
GET    /printers/:id
PATCH  /printers/:id
POST   /printers/:id/retire
POST   /printers/:id/maintenance        -- toggle 'maintenance' <-> 'idle'
POST   /printers/:id/expense

POST   /jobs/:id/start                  -- payload extended with { printerId, stages: [{name, durationMinutes}] }
POST   /jobs/:id/pause
POST   /jobs/:id/resume
POST   /jobs/:id/skip-stage
POST   /jobs/:id/confirm                -- replaces /jobs/:id/complete (route renamed; no compatibility shim)
```

## Abilities

Add to `app/abilities/`:

- `printers.view`
- `printers.create`
- `printers.edit`
- `printers.retire`
- `jobs.confirm` (semantically equivalent to `jobs.complete`, but separately grantable)

Existing `jobs.complete` is reused for `failJob` from any state.

## Inertia Pages

### `inertia/pages/printers/`

- `index.tsx` — table of printers: name, model, status badge, current job link, total spent (purchase cost + lifetime expenses), actions. Filter by status.
- `new.tsx` — form for manual creation (printers not bought through the system).
- `show.tsx` — header (name, model, serial, acquired_at, status), tabs for **Jobs** (paginated history) and **Expenses** (list + inline "Add expense" form). Retire / toggle-maintenance buttons in the header.

### `inertia/pages/jobs/show.tsx` additions

- Assigned printer badge with link.
- Stages list: each stage shows name, planned duration, status. The active stage renders the live countdown component.
- Overall progress bar = `completed_stages / total_stages`.
- Action buttons (visibility driven by status):
  - `in_progress`: **Pause**, **Skip stage**, **Mark failed**.
  - `paused`: **Resume**, **Skip stage**, **Confirm**, **Mark failed**.
  - `awaiting_confirmation`: prominent "Confirm produced quantity" card (input defaults to `planned_qty`) and **Mark failed**.
  - `completed` / `failed` / `cancelled`: no actions.

### `inertia/pages/jobs/start.tsx` (or modal on `jobs/index`)

- Printer select listing only `status='idle'` printers.
- "Stages" repeater: rows of `{ name, duration }`. One row by default labelled "Print". `+ Add stage` appends. Each duration ≥ 1 minute.

### `inertia/pages/purchases/show.tsx`

For each line where `item_kind='printer'`, show a link to the resulting printer(s) created on confirm.

### `inertia/components/jobs/job-countdown.tsx`

Pure client component. Props: `{ autoCompleteAt: string | null; remainingSeconds: number | null; paused: boolean }`.

- If `paused`: shows frozen "Paused — Xh Ym left" from `remainingSeconds`, no ticking.
- Else: counts down from `autoCompleteAt`. On reaching zero shows "Awaiting confirmation" without waiting for a page reload. The backend will catch up within one scheduler tick; the UI is purely cosmetic.

## View Models

- `getPrintersIndexViewModel` — joins purchase cost via `purchase_item_id`, sums expenses per printer.
- `getPrinterShowViewModel` — printer + paginated jobs + paginated expenses.
- `getJobShowViewModel` — extended with `printer`, `stages`, `auto_complete_at`, `remaining_seconds`, `paused`.

All Inertia payloads run through transformers (`PrinterTransformer`, `JobStageTransformer`, `ExpenseTransformer`).

## Concurrency and Failure Modes

- **Printer double-assignment**: prevented by row lock during `startJob` plus the partial unique index. Any concurrent `startJob` on the same printer fails with a DB constraint violation, translated to a `DomainError`.
- **Scheduler / user race**: `pauseJob` and a scheduler tick can target the same job at the same moment; `FOR UPDATE SKIP LOCKED` causes one to back off cleanly. Result is whichever transaction commits first wins.
- **Multiple scheduler instances**: prevented by `SCHEDULER_ENABLED=true` env flag on a single process. Even if accidentally enabled in two processes, `SKIP LOCKED` keeps state consistent.
- **Clock skew**: `now()` is the database's clock; the application never compares timestamps client-side for state transitions. Browser countdowns are cosmetic only.
- **Crashed scheduler / process restart**: harmless. The next tick re-runs the same query and picks up everything overdue.

## Tests

New Japa functional tests under `tests/functional/`:

- `jobs/start_with_printer.spec.ts` — printer locking, idle requirement, double-assign rejected by unique index.
- `jobs/auto_complete.spec.ts` — single-stage job: scheduler moves overdue `in_progress` to `awaiting_confirmation`; ignores `paused`, `awaiting_confirmation`, `completed`.
- `jobs/multi_stage.spec.ts` — three-stage job: scheduler advances 1→2→3, then to `awaiting_confirmation`. `skipStage` mid-job skips correctly.
- `jobs/pause_resume.spec.ts` — pause freezes `auto_complete_at`; resume recomputes; scheduler ignores paused jobs.
- `jobs/confirm.spec.ts` — confirm completes job from any allowed state, credits inventory at unit cost, frees printer; `producedQty=0` routes to failure.
- `printers/index.spec.ts` — list endpoint includes purchase cost and expense rollup.
- `printers/purchase_creates_printer.spec.ts` — confirming a purchase with a printer line creates that many `printers` rows with `purchase_item_id` set.
- `expenses/printer_expense.spec.ts` — printer-only expense doesn't recompute job totals; printer+job expense does.

New unit tests under `tests/unit/`:

- `scheduler/eligible_jobs.spec.ts` — query selects only `in_progress` jobs past `auto_complete_at`.
- `scheduler/stage_advance.spec.ts` — pure function that decides next stage given a stage list.

## Migrations Summary

1. `create_printers_table`
2. `add_timer_fields_to_production_jobs` (printer_id, durations, auto_complete_at, paused fields)
3. `rename_job_expenses_to_expenses_with_printer_id`
4. `add_printer_kind_to_purchase_items_check`
5. `create_production_job_stages_table_and_add_current_stage_fk`

Migrations run in this order. After each migration the schema regen via `node ace migration:run` updates `database/schema.ts`.

## Out of Scope (Explicit)

- Pause/resume of *individual stages*. Pause applies to the whole job, freezing the active stage.
- Reassigning a job to a different printer mid-print.
- Push notifications.
- Direct printer integration.
- Per-stage material consumption.
- Inventory-tracked spare parts that are also linked to a specific printer at consume time.
