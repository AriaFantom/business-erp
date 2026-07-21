import { type ReactElement, useState } from 'react'
import { Head, useForm, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import DashboardLayout from '@/layouts/dashboard-layout'

type MachineStatus = 'idle' | 'running' | 'maintenance' | 'offline' | 'retired'

interface MachineDetail {
  id: number
  name: string
  model: string | null
  serialNumber: string | null
  status: MachineStatus
  currentJobId: number | null
  notes: string | null
  acquiredAt: string | null
  hourlyRate: string
  purchaseCost: string
  expenseTotal: string
  totalSpent: string
  runMinutes30d: number
  machineCost30d: string
  lifetimeMachineMinutes: number
  lifetimeMachineCost: string
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
            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} required />
            {errors.name && <span className="text-xs text-destructive">{errors.name}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Model</Label>
            <Input value={data.model} onChange={(e) => setData('model', e.target.value)} />
            {errors.model && <span className="text-xs text-destructive">{errors.model}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Serial number</Label>
            <Input
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
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="parts">Parts</SelectItem>
                <SelectItem value="addon">Add-on</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.kind && <span className="text-xs text-destructive">{errors.kind}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>Description</Label>
            <Input
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

export default function MachineShow() {
  const { props } = usePage<{ machine: MachineDetail; jobs: JobRow[]; expenses: ExpenseRow[] }>()
  const { machine, jobs, expenses } = props
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
              Purchase cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{machine.purchaseCost}</p>
            {machine.acquiredAt && (
              <p className="text-xs text-muted-foreground">
                Acquired {machine.acquiredAt.slice(0, 10)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{machine.expenseTotal}</p>
            <p className="text-xs text-muted-foreground">
              Maintenance, parts, and add-ons over time
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{machine.totalSpent}</p>
            <p className="text-xs text-muted-foreground">Purchase + expenses</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hourly rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{machine.hourlyRate}</p>
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
                      {j.totalCost}
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
                    <TableCell className="text-right font-mono tabular-nums">{e.amount}</TableCell>
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
