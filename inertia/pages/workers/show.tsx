import { type ReactElement, useState } from 'react'
import { Head, useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ConfirmPostButton } from '@/components/confirm-post-button'
import DashboardLayout from '@/layouts/dashboard-layout'

type WorkerStatus = 'idle' | 'working' | 'inactive'

type Worker = {
  id: number
  name: string
  phone: string | null
  notes: string | null
  payType: string
  status: WorkerStatus
  hourlyRate: string
  monthlySalary: string
  standardMonthlyHours: number
  effectiveHourlyRate: string
  joinedAt: string | null
  currentJobId: number | null
  currentJobNumber: string | null
  lifetimeMinutes: number
  lifetimeLabourCost: string
  paidTotal: string
  balance: string
}

type Assignment = {
  id: number
  jobId: number
  jobNumber: string
  jobStatus: string
  assignedAt: string | null
  releasedAt: string | null
  minutesWorked: number
  hourlyRateAtAssign: string
  lineCost: string
}

type Payment = {
  id: number
  amount: string
  kind: string
  periodStart: string | null
  periodEnd: string | null
  note: string | null
  paidAt: string | null
}

type PageProps = { worker: Worker; assignments: Assignment[]; payments: Payment[] }

const STATUS_VARIANT: Record<WorkerStatus, 'default' | 'secondary' | 'outline'> = {
  idle: 'outline',
  working: 'default',
  inactive: 'secondary',
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function PaymentDialog({ workerId, payType }: { workerId: number; payType: string }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    amount: '',
    kind: payType === 'monthly' ? 'salary' : 'wages',
    periodStart: '',
    periodEnd: '',
    note: '',
    paidAt: new Date().toISOString().slice(0, 10),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Record payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/workers/${workerId}/payments`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
              placeholder="How much was paid"
              type="number"
              step="0.01"
              min={0.01}
              value={data.amount}
              onChange={(e) => setData('amount', e.target.value)}
              required
            />
            {errors.amount && <span className="text-xs text-destructive">{errors.amount}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="payment-kind">Kind</Label>
            <Select value={data.kind} onValueChange={(v) => setData('kind', v)}>
              <SelectTrigger id="payment-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wages">Wages</SelectItem>
                <SelectItem value="salary">Salary</SelectItem>
                <SelectItem value="advance">Advance</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.kind && <span className="text-xs text-destructive">{errors.kind}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="payment-period-start">Period start</Label>
              <Input
                id="payment-period-start"
                type="date"
                value={data.periodStart}
                onChange={(e) => setData('periodStart', e.target.value)}
              />
              {errors.periodStart && (
                <span className="text-xs text-destructive">{errors.periodStart}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="payment-period-end">Period end</Label>
              <Input
                id="payment-period-end"
                type="date"
                value={data.periodEnd}
                onChange={(e) => setData('periodEnd', e.target.value)}
              />
              {errors.periodEnd && (
                <span className="text-xs text-destructive">{errors.periodEnd}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="payment-paid-at">Paid on</Label>
            <Input
              id="payment-paid-at"
              type="date"
              value={data.paidAt}
              onChange={(e) => setData('paidAt', e.target.value)}
            />
            {errors.paidAt && <span className="text-xs text-destructive">{errors.paidAt}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="payment-note">Note</Label>
            <Input
              id="payment-note"
              placeholder="What is this payment for?"
              value={data.note}
              onChange={(e) => setData('note', e.target.value)}
            />
            {errors.note && <span className="text-xs text-destructive">{errors.note}</span>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({ worker }: { worker: Worker }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors } = useForm({
    name: worker.name,
    phone: worker.phone ?? '',
    payType: worker.payType,
    hourlyRate: worker.hourlyRate,
    monthlySalary: worker.monthlySalary,
    standardMonthlyHours: String(worker.standardMonthlyHours),
    notes: worker.notes ?? '',
  })

  const isMonthly = data.payType === 'monthly'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit worker</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/workers/${worker.id}`, {
              preserveScroll: true,
              onSuccess: () => setOpen(false),
            })
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              placeholder="e.g. Meera Nair"
              value={data.name}
              onChange={(e) => setData('name', e.target.value)}
            />
            {errors.name && <span className="text-xs text-destructive">{errors.name}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              placeholder="10-digit mobile number"
              value={data.phone}
              onChange={(e) => setData('phone', e.target.value)}
            />
            {errors.phone && <span className="text-xs text-destructive">{errors.phone}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-pay-type">Pay type</Label>
            <Select value={data.payType} onValueChange={(v) => setData('payType', v)}>
              <SelectTrigger id="edit-pay-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="monthly">Monthly salary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isMonthly ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-monthly-salary">Monthly salary</Label>
                <Input
                  id="edit-monthly-salary"
                  placeholder="e.g. 20800"
                  type="number"
                  step="0.01"
                  min={0}
                  value={data.monthlySalary}
                  onChange={(e) => setData('monthlySalary', e.target.value)}
                />
                {errors.monthlySalary && (
                  <span className="text-xs text-destructive">{errors.monthlySalary}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-standard-hours">Standard hours / month</Label>
                <Input
                  id="edit-standard-hours"
                  placeholder="e.g. 208"
                  type="number"
                  min={1}
                  value={data.standardMonthlyHours}
                  onChange={(e) => setData('standardMonthlyHours', e.target.value)}
                />
                {errors.standardMonthlyHours && (
                  <span className="text-xs text-destructive">{errors.standardMonthlyHours}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label htmlFor="edit-hourly-rate">Hourly rate</Label>
              <Input
                id="edit-hourly-rate"
                placeholder="e.g. 120"
                type="number"
                step="0.01"
                min={0}
                value={data.hourlyRate}
                onChange={(e) => setData('hourlyRate', e.target.value)}
              />
              {errors.hourlyRate && (
                <span className="text-xs text-destructive">{errors.hourlyRate}</span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              placeholder="Skills, availability, anything worth remembering"
              rows={3}
              value={data.notes}
              onChange={(e) => setData('notes', e.target.value)}
            />
            {errors.notes && <span className="text-xs text-destructive">{errors.notes}</span>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function WorkerShow({ worker, assignments, payments }: PageProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <Head title={worker.name} />
      <div>
        <Link
          href="/workers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to workers
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{worker.name}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="capitalize">{worker.payType}</span> · {worker.effectiveHourlyRate} /
              hour
              {worker.phone ? ` · ${worker.phone}` : ''}
              {worker.currentJobId && (
                <>
                  {' · on '}
                  <Link
                    href={`/jobs/${worker.currentJobId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {worker.currentJobNumber ?? `#${worker.currentJobId}`}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[worker.status]}>{worker.status}</Badge>
            <EditDialog worker={worker} />
            <PaymentDialog workerId={worker.id} payType={worker.payType} />
            {worker.status === 'inactive' ? (
              <ConfirmPostButton
                path={`/workers/${worker.id}/reactivate`}
                label="Reactivate"
                confirmTitle="Reactivate this worker?"
              />
            ) : (
              <ConfirmPostButton
                path={`/workers/${worker.id}/retire`}
                label="Deactivate"
                variant="destructive"
                confirmTitle="Deactivate this worker?"
                confirmDescription="They will no longer be assignable to jobs."
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Pay type</dt>
              <dd className="text-right capitalize">{worker.payType}</dd>
              {worker.payType === 'monthly' ? (
                <>
                  <dt className="text-muted-foreground">Monthly salary</dt>
                  <dd className="text-right">{worker.monthlySalary}</dd>
                  <dt className="text-muted-foreground">Standard hours / month</dt>
                  <dd className="text-right">{worker.standardMonthlyHours}</dd>
                </>
              ) : (
                <>
                  <dt className="text-muted-foreground">Hourly rate</dt>
                  <dd className="text-right">{worker.hourlyRate}</dd>
                </>
              )}
              <dt className="font-medium">Effective hourly rate</dt>
              <dd className="text-right font-medium">{worker.effectiveHourlyRate}</dd>
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="text-right font-mono text-xs">
                {worker.joinedAt?.slice(0, 10) ?? '—'}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work &amp; payments</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Time worked (lifetime)</dt>
              <dd className="text-right">{formatMinutes(worker.lifetimeMinutes)}</dd>
              <dt className="text-muted-foreground">Labour cost booked</dt>
              <dd className="text-right">{worker.lifetimeLabourCost}</dd>
              <dt className="text-muted-foreground">Paid to date</dt>
              <dd className="text-right">{worker.paidTotal}</dd>
              <dt className="font-medium">Booked − paid</dt>
              <dd className="text-right font-medium">{worker.balance}</dd>
            </dl>
            {worker.payType === 'monthly' && (
              <p className="mt-3 text-xs text-muted-foreground">
                Salaried workers are paid on the calendar, not per job — the balance above is
                informational.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {worker.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{worker.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job history</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not assigned to any job yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/jobs/${a.jobId}`}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {a.jobNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{a.jobStatus}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {a.assignedAt?.slice(0, 16).replace('T', ' ') ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {a.releasedAt?.slice(0, 16).replace('T', ' ') ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatMinutes(a.minutesWorked)}</TableCell>
                    <TableCell className="text-right">{a.hourlyRateAtAssign}</TableCell>
                    <TableCell className="text-right">{a.lineCost}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid on</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.paidAt?.slice(0, 10) ?? '—'}
                    </TableCell>
                    <TableCell className="capitalize">{p.kind}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.periodStart || p.periodEnd
                        ? `${p.periodStart ?? '…'} → ${p.periodEnd ?? '…'}`
                        : '—'}
                    </TableCell>
                    <TableCell>{p.note ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.amount}</TableCell>
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

WorkerShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
