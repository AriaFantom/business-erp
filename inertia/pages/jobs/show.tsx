import { type ReactElement, useMemo, useState } from 'react'
import { useForm, router, usePage } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Link } from '@adonisjs/inertia/react'
import { StatusBadge } from '@/components/status-badge'
import DashboardLayout from '@/layouts/dashboard-layout'
import { JobStagesList, type StageView } from '@/components/jobs/job-stages-list'
import { JobStagesRepeater, type StageDraft } from '@/components/jobs/job-stages-repeater'
import { JobProgress } from '@/components/jobs/job-progress'

type JobStatus =
  | 'draft'
  | 'in_progress'
  | 'paused'
  | 'awaiting_confirmation'
  | 'completed'
  | 'failed'
  | 'cancelled'

type Job = {
  id: number
  number: string
  status: JobStatus
  productId: number
  productName: string
  plannedQty: number
  producedQty: number
  parentJobId: number | null
  startedAt: string | null
  completedAt: string | null
  totalMaterialCost: string
  totalComponentCost: string
  totalExpense: string
  totalCost: string
  unitCost: string
  chainCost: string
  note: string | null
  // new fields
  machineId: number | null
  machineName: string | null
  autoCompleteAt: string | null
  estimatedDurationMin: number | null
  pausedAt: string | null
  remainingSeconds: number | null
  currentStageId: number | null
}

type Consumption = {
  id: number
  itemKind: string
  itemId: number
  itemName: string
  itemSku: string
  qtyConsumed: string
  qtyWasted: string
  unitCostAtConsume: string
  lineCost: string
  reason: string
  createdAt: string | null
}

type Expense = {
  id: number
  kind: string
  description: string
  amount: string
  incurredAt: string | null
}

type InventoryItem = {
  itemKind: 'material' | 'component'
  itemId: number
  sku: string
  name: string
  unit: string
  onHand: string
}

type IdleMachine = {
  id: number
  name: string
}

type RecipeItem = {
  itemKind: 'material' | 'component'
  itemId: number
  qtyPerUnit: string
}

type PageProps = {
  job: Job
  consumptions: Consumption[]
  expenses: Expense[]
  inventoryItems: InventoryItem[]
  stages: StageView[]
  idleMachines: IdleMachine[]
  productRecipe: RecipeItem[]
  serverNow: string
}

function PostAction({
  path,
  label,
  variant = 'default',
  confirmText,
}: {
  path: string
  label: string
  variant?: 'default' | 'destructive' | 'outline'
  confirmText?: string
}) {
  const { post, processing } = useForm()
  const [open, setOpen] = useState(false)
  const submit = () => post(path, { preserveScroll: true })
  return (
    <>
      <Button
        variant={variant}
        disabled={processing}
        onClick={() => (confirmText ? setOpen(true) : submit())}
      >
        {label}
      </Button>
      {confirmText && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={confirmText}
          confirmLabel="Yes"
          cancelLabel="No"
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onConfirm={submit}
        />
      )}
    </>
  )
}

function ConsumeDialog({ jobId, items }: { jobId: number; items: InventoryItem[] }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')
  const { data, setData, post, processing, errors, reset } = useForm({
    itemKind: '',
    itemId: 0,
    qtyConsumed: 0,
    qtyWasted: 0,
    reason: 'consume',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Consume material</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consume material</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/jobs/${jobId}/consumptions`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setTarget('')
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Item" error={errors.itemKind ?? errors.itemId}>
            <Select
              value={target}
              onValueChange={(v) => {
                setTarget(v)
                const [kind, id] = v.split(':')
                setData('itemKind', kind)
                setData('itemId', Number(id))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((it) => (
                  <SelectItem
                    key={`${it.itemKind}:${it.itemId}`}
                    value={`${it.itemKind}:${it.itemId}`}
                  >
                    [{it.itemKind}] {it.name} — on hand {it.onHand} {it.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={`Qty consumed${
              target
                ? ` (${items.find((it) => `${it.itemKind}:${it.itemId}` === target)?.unit ?? ''})`
                : ''
            }`}
            error={errors.qtyConsumed}
          >
            <Input
              type="number"
              step="0.001"
              value={data.qtyConsumed}
              onChange={(e) => setData('qtyConsumed', Number(e.target.value))}
            />
          </Field>
          <Field
            label={`Of which wasted${
              target
                ? ` (${items.find((it) => `${it.itemKind}:${it.itemId}` === target)?.unit ?? ''})`
                : ''
            }`}
            error={errors.qtyWasted}
          >
            <Input
              type="number"
              step="0.001"
              value={data.qtyWasted}
              onChange={(e) => setData('qtyWasted', Number(e.target.value))}
            />
          </Field>
          <Field label="Reason" error={errors.reason}>
            <Select value={data.reason} onValueChange={(v) => setData('reason', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consume">consume</SelectItem>
                <SelectItem value="reprint">reprint</SelectItem>
                <SelectItem value="waste">waste</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={processing || !target}>
              {processing ? 'Saving…' : 'Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExpenseDialog({ jobId }: { jobId: number }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    kind: 'electricity',
    description: '',
    amount: 0,
    incurredAt: new Date().toISOString().slice(0, 10),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/jobs/${jobId}/expenses`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Kind" error={errors.kind}>
            <Select value={data.kind} onValueChange={(v) => setData('kind', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="electricity">electricity</SelectItem>
                <SelectItem value="labor">labor</SelectItem>
                <SelectItem value="overhead">overhead</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description" error={errors.description}>
            <Input
              value={data.description}
              onChange={(e) => setData('description', e.target.value)}
            />
          </Field>
          <Field label="Amount" error={errors.amount}>
            <Input
              type="number"
              step="0.01"
              value={data.amount}
              onChange={(e) => setData('amount', Number(e.target.value))}
            />
          </Field>
          <Field label="Incurred on" error={errors.incurredAt}>
            <Input
              type="date"
              value={data.incurredAt}
              onChange={(e) => setData('incurredAt', e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FailDialog({ jobId }: { jobId: number }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    reason: '',
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Mark failed</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark job as failed</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/jobs/${jobId}/fail`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Reason" error={errors.reason}>
            <Input value={data.reason} onChange={(e) => setData('reason', e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={processing}>
              {processing ? 'Saving…' : 'Mark failed'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmJobCard({ jobId, plannedQty }: { jobId: number; plannedQty: number }) {
  const [producedQty, setProducedQty] = useState(plannedQty)
  const [submitting, setSubmitting] = useState(false)
  const submit = () => {
    setSubmitting(true)
    router.post(`/jobs/${jobId}/confirm`, { producedQty }, { preserveScroll: true })
  }
  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>Confirm job completion</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          The print has finished. Confirm the produced quantity to complete the job.
        </p>
        <Field label="Produced qty">
          <Input
            type="number"
            min={0}
            value={producedQty}
            onChange={(e) => setProducedQty(Number(e.target.value))}
          />
        </Field>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Confirming…' : 'Confirm'}
          </Button>
          <FailDialog jobId={jobId} />
        </div>
      </CardContent>
    </Card>
  )
}

type ConsumptionDraft = {
  key: string
  target: string
  qtyConsumed: number
}

function StartForm({
  jobId,
  plannedQty,
  idleMachines,
  inventoryItems,
  productRecipe,
}: {
  jobId: number
  plannedQty: number
  idleMachines: IdleMachine[]
  inventoryItems: InventoryItem[]
  productRecipe: RecipeItem[]
}) {
  const { props } = usePage<{ errors: Record<string, string> }>()
  const serverErrors = props.errors ?? {}

  const [machineId, setMachineId] = useState<string>('')
  const [stages, setStages] = useState<StageDraft[]>([{ name: 'Stage 1', durationMinutes: 30 }])

  const initialDrafts = useMemo<ConsumptionDraft[]>(() => {
    if (productRecipe.length === 0) {
      return [{ key: cryptoKey(), target: '', qtyConsumed: 0 }]
    }
    return productRecipe.map((r) => ({
      key: cryptoKey(),
      target: `${r.itemKind}:${r.itemId}`,
      qtyConsumed: round4(Number(r.qtyPerUnit) * plannedQty),
    }))
  }, [productRecipe, plannedQty])

  const [drafts, setDrafts] = useState<ConsumptionDraft[]>(initialDrafts)
  const [submitting, setSubmitting] = useState(false)

  const updateDraft = (key: string, patch: Partial<ConsumptionDraft>) =>
    setDrafts((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const addRow = () =>
    setDrafts((rows) => [...rows, { key: cryptoKey(), target: '', qtyConsumed: 0 }])
  const removeRow = (key: string) =>
    setDrafts((rows) => (rows.length === 1 ? rows : rows.filter((r) => r.key !== key)))

  const consumptions = drafts
    .filter((d) => d.target && d.qtyConsumed > 0)
    .map((d) => {
      const [kind, id] = d.target.split(':')
      return {
        itemKind: kind as 'material' | 'component',
        itemId: Number(id),
        qtyConsumed: d.qtyConsumed,
      }
    })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    router.post(
      `/jobs/${jobId}/start`,
      { machineId: machineId ? Number(machineId) : null, stages, consumptions },
      {
        preserveScroll: true,
        onFinish: () => setSubmitting(false),
      }
    )
  }

  const unitFor = (target: string) =>
    inventoryItems.find((it) => `${it.itemKind}:${it.itemId}` === target)?.unit ?? ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start job</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field label="Machine" error={serverErrors.machineId}>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a machine" />
              </SelectTrigger>
              <SelectContent>
                {idleMachines.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <JobStagesRepeater value={stages} onChange={setStages} />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Materials &amp; components to consume</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                Add row
              </Button>
            </div>
            {serverErrors.consumptions && (
              <span className="text-xs text-destructive">{serverErrors.consumptions}</span>
            )}
            {drafts.map((row, idx) => (
              <div
                key={row.key}
                className="grid grid-cols-[1fr_140px_auto] items-end gap-2 rounded-md border p-3"
              >
                <Field
                  label={idx === 0 ? 'Item' : ''}
                  error={serverErrors[`consumptions.${idx}.itemId`]}
                >
                  <Select
                    value={row.target}
                    onValueChange={(v) => updateDraft(row.key, { target: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick item" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map((it) => (
                        <SelectItem
                          key={`${it.itemKind}:${it.itemId}`}
                          value={`${it.itemKind}:${it.itemId}`}
                        >
                          [{it.itemKind}] {it.name} — on hand {it.onHand} {it.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label={
                    idx === 0
                      ? `Qty${row.target ? ` (${unitFor(row.target)})` : ''}`
                      : row.target
                        ? `(${unitFor(row.target)})`
                        : ''
                  }
                  error={serverErrors[`consumptions.${idx}.qtyConsumed`]}
                >
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={row.qtyConsumed}
                    onChange={(e) =>
                      updateDraft(row.key, { qtyConsumed: Number(e.target.value) })
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeRow(row.key)}
                  disabled={drafts.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              You must pick at least one material or component before the job can start.
            </p>
          </div>

          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Starting…' : 'Start'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function cryptoKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

export default function JobShow({
  job,
  consumptions,
  expenses,
  inventoryItems,
  stages,
  idleMachines,
  productRecipe,
  serverNow,
}: PageProps) {
  const isActive =
    job.status === 'in_progress' ||
    job.status === 'paused' ||
    job.status === 'awaiting_confirmation'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job {job.number}</h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/catalog/products/${job.productId}`}
              className="underline-offset-2 hover:underline"
            >
              {job.productName}
            </Link>{' '}
            · planned {job.plannedQty} · produced {job.producedQty}
            {job.parentJobId ? (
              <>
                {' · reprint of '}
                <Link
                  href={`/jobs/${job.parentJobId}`}
                  className="underline-offset-2 hover:underline"
                >
                  #{job.parentJobId}
                </Link>
              </>
            ) : null}
            {job.machineName ? ` · machine: ${job.machineName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="job" status={job.status} />
          {isActive && (
            <>
              <ConsumeDialog jobId={job.id} items={inventoryItems} />
              <ExpenseDialog jobId={job.id} />
            </>
          )}
          {(job.status === 'draft' || job.status === 'in_progress') && (
            <PostAction
              path={`/jobs/${job.id}/cancel`}
              label="Cancel"
              variant="destructive"
              confirmText="Cancel this job?"
            />
          )}
        </div>
      </div>

      {/* Stage list — shown whenever there are stages */}
      {stages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <JobStagesList
              stages={stages}
              paused={!!job.pausedAt}
              remainingSeconds={job.remainingSeconds}
              serverNow={serverNow}
            />
          </CardContent>
        </Card>
      )}

      {/* Status actions */}
      {job.status === 'in_progress' && (
        <div className="flex flex-wrap items-center gap-2">
          <PostAction path={`/jobs/${job.id}/pause`} label="Pause" variant="outline" />
          <PostAction
            path={`/jobs/${job.id}/skip-stage`}
            label="Skip stage"
            variant="outline"
            confirmText="Skip the current stage?"
          />
          <FailDialog jobId={job.id} />
        </div>
      )}

      {job.status === 'paused' && (
        <div className="flex flex-wrap items-center gap-2">
          <PostAction path={`/jobs/${job.id}/resume`} label="Resume" />
          <PostAction
            path={`/jobs/${job.id}/skip-stage`}
            label="Skip stage"
            variant="outline"
            confirmText="Skip the current stage?"
          />
          <FailDialog jobId={job.id} />
        </div>
      )}

      {job.status === 'awaiting_confirmation' && (
        <ConfirmJobCard jobId={job.id} plannedQty={job.plannedQty} />
      )}

      {/* Start form — only on draft */}
      {job.status === 'draft' && (
        <StartForm
          jobId={job.id}
          plannedQty={job.plannedQty}
          idleMachines={idleMachines}
          inventoryItems={inventoryItems}
          productRecipe={productRecipe}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Material cost</dt>
              <dd className="text-right">{job.totalMaterialCost}</dd>
              <dt className="text-muted-foreground">Component cost</dt>
              <dd className="text-right">{job.totalComponentCost}</dd>
              <dt className="text-muted-foreground">Expenses</dt>
              <dd className="text-right">{job.totalExpense}</dd>
              <dt className="font-medium">Total</dt>
              <dd className="text-right font-medium">{job.totalCost}</dd>
              <dt className="text-muted-foreground">Unit cost</dt>
              <dd className="text-right">{job.unitCost}</dd>
              <dt className="text-muted-foreground">Reprint chain cost</dt>
              <dd className="text-right">{job.chainCost}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(job.status === 'in_progress' ||
              job.status === 'paused' ||
              job.status === 'awaiting_confirmation') && (
              <JobProgress
                stages={stages}
                paused={!!job.pausedAt}
                remainingSeconds={job.remainingSeconds}
                startedAt={job.startedAt}
                autoCompleteAt={job.autoCompleteAt}
                estimatedDurationMin={job.estimatedDurationMin}
                serverNow={serverNow}
              />
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Started</dt>
              <dd className="text-right font-mono text-xs">
                {job.startedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
              </dd>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="text-right font-mono text-xs">
                {job.completedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
              </dd>
              {job.estimatedDurationMin != null && (
                <>
                  <dt className="text-muted-foreground">Est. duration</dt>
                  <dd className="text-right">{job.estimatedDurationMin} min</dd>
                </>
              )}
              {job.pausedAt && (
                <>
                  <dt className="text-muted-foreground">Paused at</dt>
                  <dd className="text-right font-mono text-xs">
                    {job.pausedAt.slice(0, 19).replace('T', ' ')}
                  </dd>
                </>
              )}
            </dl>
            {job.note && <p className="mt-3 text-sm text-muted-foreground">{job.note}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumptions</CardTitle>
        </CardHeader>
        <CardContent>
          {consumptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing consumed yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Wasted</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Line cost</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumptions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">
                      {c.createdAt?.slice(0, 19).replace('T', ' ') ?? '—'}
                    </TableCell>
                    <TableCell>{c.itemKind}</TableCell>
                    <TableCell>{c.itemName}</TableCell>
                    <TableCell className="text-right">{c.qtyConsumed}</TableCell>
                    <TableCell className="text-right">{c.qtyWasted}</TableCell>
                    <TableCell className="text-right">{c.unitCostAtConsume}</TableCell>
                    <TableCell className="text-right">{c.lineCost}</TableCell>
                    <TableCell>{c.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses logged.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.incurredAt?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell>{e.kind}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-right">{e.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

JobShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
