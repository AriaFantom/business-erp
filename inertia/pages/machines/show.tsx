import { type ReactElement, useState } from 'react'
import { Head, useForm, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { formatMoney, useCurrency } from '@/lib/currency'
import {
  Select,
  SelectContent,
  SelectGroup,
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
import DashboardLayout from '@/layouts/dashboard-layout'
import { DeletePermanentlyAction } from '@/components/catalog/delete-permanently-action'
import type { InertiaProps } from '@/types'

type MachineStatus = 'idle' | 'running' | 'maintenance' | 'offline' | 'retired'

type MachineDetail = {
  id: number
  name: string
  model: string | null
  serialNumber: string | null
  status: MachineStatus
  currentJobId: number | null
  notes: string | null
  acquiredAt: string | null
  hourlyRate: string
  purchaseCost: string | null
  expenseTotal: string
  standaloneExpenseTotal: string
  totalSpent: string | null
  soldQty: number
  salesRevenue: string
  productionCost: string
  salesProfit: string
  afterPurchaseAndExpenses: string | null
  deleteBlocker: string | null
  runMinutes30d: number
  machineCost30d: string
  lifetimeMachineMinutes: number
  lifetimeMachineCost: string
}
type JobRow = {
  id: number
  number: string
  status: string
  startedAt: string | null
  completedAt: string | null
  totalCost: string
}
type ExpenseRow = {
  id: number
  kind: string
  description: string
  amount: string
  incurredAt: string
}
type UsageRow = {
  itemKind: string
  itemId: number
  name: string
  unit: string
  usedQty: string
  wastedQty: string
}
type Acquisition = {
  purchaseId: number
  purchaseNumber: string
  supplierName: string
  purchasedAt: string
}

const STATUS_VARIANT: Record<MachineStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  idle: 'outline',
  running: 'default',
  maintenance: 'secondary',
  offline: 'secondary',
  retired: 'destructive',
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function EditMachineDialog({ machine }: { machine: MachineDetail }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors } = useForm({
    name: machine.name,
    model: machine.model ?? '',
    serialNumber: machine.serialNumber ?? '',
    notes: machine.notes ?? '',
    hourlyRate: machine.hourlyRate,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit machine</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/machines/${machine.id}`, {
              preserveScroll: true,
              onSuccess: () => setOpen(false),
            })
          }}
        >
          <div className="flex flex-col gap-1">
            <Label>Name</Label>
            <Input
              placeholder="e.g. Sewing Machine 1"
              value={data.name}
              onChange={(e) => setData('name', e.target.value)}
              required
            />
            {errors.name && <span className="text-xs text-destructive">{errors.name}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Model</Label>
            <Input
              placeholder="e.g. Juki DDL-8700"
              value={data.model}
              onChange={(e) => setData('model', e.target.value)}
            />
            {errors.model && <span className="text-xs text-destructive">{errors.model}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Serial number</Label>
            <Input
              placeholder="Manufacturer serial, if any"
              value={data.serialNumber}
              onChange={(e) => setData('serialNumber', e.target.value)}
            />
            {errors.serialNumber && (
              <span className="text-xs text-destructive">{errors.serialNumber}</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Hourly rate</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="Cost per machine-hour"
              value={data.hourlyRate}
              onChange={(e) => setData('hourlyRate', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cost per machine-hour (electricity + depreciation + upkeep) — folded into job cost
              from actual run time.
            </p>
            {errors.hourlyRate && (
              <span className="text-xs text-destructive">{errors.hourlyRate}</span>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddExpenseDialog({ machineId }: { machineId: number }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    kind: 'maintenance',
    description: '',
    amount: 0,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add machine expense</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/machines/${machineId}/expense`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <div className="flex flex-col gap-1">
            <Label>Kind</Label>
            <Select value={data.kind} onValueChange={(v) => setData('kind', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="parts">Parts</SelectItem>
                  <SelectItem value="addon">Add-on</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors.kind && <span className="text-xs text-destructive">{errors.kind}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Description</Label>
            <Textarea
              rows={3}
              className="resize-none"
              placeholder="What was this expense for?"
              value={data.description}
              onChange={(e) => setData('description', e.target.value)}
              required
            />
            {errors.description && (
              <span className="text-xs text-destructive">{errors.description}</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min={0.01}
              placeholder="How much was spent"
              value={data.amount}
              onChange={(e) => setData('amount', Number(e.target.value))}
              required
            />
            {errors.amount && <span className="text-xs text-destructive">{errors.amount}</span>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
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
          confirmLabel={label}
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onConfirm={submit}
        />
      )}
    </>
  )
}

const UNIT_FAMILIES: Record<string, { unit: string; factor: number }[]> = {
  mg: [
    { unit: 'mg', factor: 0.001 },
    { unit: 'g', factor: 1 },
    { unit: 'kg', factor: 1000 },
  ],
  g: [
    { unit: 'mg', factor: 0.001 },
    { unit: 'g', factor: 1 },
    { unit: 'kg', factor: 1000 },
  ],
  kg: [
    { unit: 'mg', factor: 0.001 },
    { unit: 'g', factor: 1 },
    { unit: 'kg', factor: 1000 },
  ],
  ml: [
    { unit: 'ml', factor: 1 },
    { unit: 'l', factor: 1000 },
  ],
  l: [
    { unit: 'ml', factor: 1 },
    { unit: 'l', factor: 1000 },
  ],
  mm: [
    { unit: 'mm', factor: 0.001 },
    { unit: 'cm', factor: 0.01 },
    { unit: 'm', factor: 1 },
  ],
  cm: [
    { unit: 'mm', factor: 0.001 },
    { unit: 'cm', factor: 0.01 },
    { unit: 'm', factor: 1 },
  ],
  m: [
    { unit: 'mm', factor: 0.001 },
    { unit: 'cm', factor: 0.01 },
    { unit: 'm', factor: 1 },
  ],
}

function QuantityWithUnit({ quantity, storedUnit }: { quantity: string; storedUnit: string }) {
  const stored = storedUnit.toLowerCase()
  const family = UNIT_FAMILIES[stored]
  const [unit, setUnit] = useState(stored)
  const storedFactor = family?.find((option) => option.unit === stored)?.factor ?? 1
  const selectedFactor = family?.find((option) => option.unit === unit)?.factor ?? 1
  const formatted = ((Number(quantity) * storedFactor) / selectedFactor).toLocaleString(undefined, {
    maximumFractionDigits: 9,
  })

  if (!family)
    return (
      <span className="tabular-nums">
        {formatted} {storedUnit}
      </span>
    )
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="tabular-nums">{formatted}</span>
      <Select value={unit} onValueChange={setUnit}>
        <SelectTrigger className="h-8 w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {family.map((option) => (
              <SelectItem key={option.unit} value={option.unit}>
                {option.unit}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export default function MachineShow() {
  const currency = useCurrency()
  type PageProps = {
    machine: MachineDetail
    jobs: JobRow[]
    expenses: ExpenseRow[]
    usage: UsageRow[]
    acquisition: Acquisition | null
  }
  const { props } = usePage<InertiaProps<PageProps>>()
  const { machine, jobs, expenses, usage, acquisition, user } = props
  const canDelete = Boolean(user?.isOwner || user?.permissions?.includes('machines.delete'))
  const isRetired = machine.status === 'retired'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <Head title={machine.name} />
      <div>
        <Link
          href="/machines"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to machines
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{machine.name}</h1>
            <p className="text-sm text-muted-foreground">
              {machine.model ?? '—'}
              {machine.serialNumber ? ` · SN: ${machine.serialNumber}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[machine.status]}>{machine.status}</Badge>
            <EditMachineDialog machine={machine} />
            {!isRetired && <AddExpenseDialog machineId={machine.id} />}
            {!isRetired && (
              <PostAction
                path={`/machines/${machine.id}/maintenance`}
                label={machine.status === 'maintenance' ? 'End maintenance' : 'Start maintenance'}
                variant="outline"
              />
            )}
            {canDelete && (
              <DeletePermanentlyAction
                path={`/machines/${machine.id}/delete`}
                name={machine.name}
                blockedReason={machine.deleteBlocker}
              />
            )}
            {!isRetired && (
              <PostAction
                path={`/machines/${machine.id}/retire`}
                label="Retire"
                variant="destructive"
                confirmText={`Retire ${machine.name}? This cannot be undone.`}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Acquisition cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {machine.purchaseCost === null
                ? 'Not recorded'
                : formatMoney(machine.purchaseCost, currency)}
            </p>
            {acquisition ? (
              <p className="text-xs text-muted-foreground">
                <Link href={`/purchases/${acquisition.purchaseId}`} className="hover:underline">
                  {acquisition.purchaseNumber}
                </Link>{' '}
                · {acquisition.supplierName}
              </p>
            ) : machine.acquiredAt ? (
              <p className="text-xs text-muted-foreground">
                Acquired {machine.acquiredAt.slice(0, 10)}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sales profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(machine.salesProfit, currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              Sales excluding tax − tracked production cost
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              After purchase and expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {machine.afterPurchaseAndExpenses === null
                ? 'Not available'
                : formatMoney(machine.afterPurchaseAndExpenses, currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              Sales profit − acquisition − standalone expenses
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracked sales</CardTitle>
          <CardDescription>
            Starts from this rollout and uses each job’s captured production cost.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Sold quantity</p>
            <p className="text-xl font-semibold tabular-nums">{machine.soldQty}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sales revenue</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(machine.salesRevenue, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Production cost</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(machine.productionCost, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Standalone expenses</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(machine.standaloneExpenseTotal, currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Material and component usage</CardTitle>
          <CardDescription>
            Lifetime usage with returns deducted; waste is separate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked consumption yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Waste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((row) => (
                  <TableRow key={`${row.itemKind}-${row.itemId}`}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {row.itemKind}
                    </TableCell>
                    <TableCell className="text-right">
                      <QuantityWithUnit quantity={row.usedQty} storedUnit={row.unit} />
                    </TableCell>
                    <TableCell className="text-right">
                      <QuantityWithUnit quantity={row.wastedQty} storedUnit={row.unit} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Hourly rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(machine.hourlyRate, currency)}
            </p>
            <p className="text-xs text-muted-foreground">Folded into job cost from run time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Run time (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMinutes(machine.runMinutes30d)}
            </p>
            <p className="text-xs text-muted-foreground">Completed stage time, last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recovered (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{machine.machineCost30d}</p>
            <p className="text-xs text-muted-foreground">Machine cost booked to jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime run time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMinutes(machine.lifetimeMachineMinutes)}
            </p>
            <p className="text-xs text-muted-foreground">
              {machine.lifetimeMachineCost} recovered all-time
            </p>
          </CardContent>
        </Card>
      </div>

      {machine.currentJobId && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Currently running</CardTitle>
            <CardDescription>
              This machine is locked to{' '}
              <Link href={`/jobs/${machine.currentJobId}`} className="font-medium hover:underline">
                Job #{machine.currentJobId}
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {machine.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{machine.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job history</CardTitle>
          <CardDescription>Up to 50 most recent jobs run on this machine.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs have run on this machine yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">
                      <Link href={`/jobs/${j.id}`} className="hover:underline">
                        {j.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{j.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {j.startedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {j.completedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatMoney(j.totalCost, currency)}
                    </TableCell>
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
          <CardDescription>
            Maintenance, repair parts, and add-ons charged to this machine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses logged yet.</p>
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
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {e.incurredAt.slice(0, 10)}
                    </TableCell>
                    <TableCell>{e.kind}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatMoney(e.amount, currency)}
                    </TableCell>
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

MachineShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
