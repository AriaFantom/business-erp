import { type ReactElement } from 'react'
import { Head, useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import DashboardLayout from '@/layouts/dashboard-layout'

export default function WorkerNew() {
  const form = useForm({
    name: '',
    phone: '',
    payType: 'hourly',
    hourlyRate: '0',
    monthlySalary: '0',
    standardMonthlyHours: '208',
    joinedAt: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const isMonthly = form.data.payType === 'monthly'
  const derivedRate =
    isMonthly && Number(form.data.standardMonthlyHours) > 0
      ? (
          Number(form.data.monthlySalary) / Number(form.data.standardMonthlyHours)
        ).toFixed(2)
      : null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <Head title="Add worker" />
      <div>
        <Link
          href="/workers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to workers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add worker</h1>
        <p className="text-sm text-muted-foreground">
          Register someone so their time can be assigned to jobs and costed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker details</CardTitle>
          <CardDescription>Only the name and pay type are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              form.transform((d) => ({
                name: d.name,
                phone: d.phone || undefined,
                notes: d.notes || undefined,
                payType: d.payType,
                hourlyRate: d.payType === 'hourly' ? Number(d.hourlyRate) : 0,
                monthlySalary: d.payType === 'monthly' ? Number(d.monthlySalary) : 0,
                standardMonthlyHours: Number(d.standardMonthlyHours),
                joinedAt: d.joinedAt || undefined,
              }))
              form.post('/workers')
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="worker-name">
                Name<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                id="worker-name"
                value={form.data.name}
                onChange={(e) => form.setData('name', e.target.value)}
                required
              />
              {form.errors.name && (
                <span className="text-xs text-destructive">{form.errors.name}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="worker-phone">Phone</Label>
              <Input
                id="worker-phone"
                value={form.data.phone}
                onChange={(e) => form.setData('phone', e.target.value)}
              />
              {form.errors.phone && (
                <span className="text-xs text-destructive">{form.errors.phone}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="worker-pay-type">
                Pay type<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Select
                value={form.data.payType}
                onValueChange={(v) => form.setData('payType', v)}
              >
                <SelectTrigger id="worker-pay-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="monthly">Monthly salary</SelectItem>
                </SelectContent>
              </Select>
              {form.errors.payType && (
                <span className="text-xs text-destructive">{form.errors.payType}</span>
              )}
            </div>

            {isMonthly ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="worker-monthly-salary">Monthly salary</Label>
                  <Input
                    id="worker-monthly-salary"
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.data.monthlySalary}
                    onChange={(e) => form.setData('monthlySalary', e.target.value)}
                  />
                  {form.errors.monthlySalary && (
                    <span className="text-xs text-destructive">
                      {form.errors.monthlySalary}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="worker-standard-hours">Standard hours / month</Label>
                  <Input
                    id="worker-standard-hours"
                    type="number"
                    min={1}
                    value={form.data.standardMonthlyHours}
                    onChange={(e) => form.setData('standardMonthlyHours', e.target.value)}
                  />
                  {form.errors.standardMonthlyHours && (
                    <span className="text-xs text-destructive">
                      {form.errors.standardMonthlyHours}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Job cost uses the derived hourly rate
                  {derivedRate ? ` — currently ${derivedRate} / hour` : ''}.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Label htmlFor="worker-hourly-rate">Hourly rate</Label>
                <Input
                  id="worker-hourly-rate"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.data.hourlyRate}
                  onChange={(e) => form.setData('hourlyRate', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Folded into job cost from the actual time worked on the job.
                </p>
                {form.errors.hourlyRate && (
                  <span className="text-xs text-destructive">{form.errors.hourlyRate}</span>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label htmlFor="worker-joined-at">Joined on</Label>
              <Input
                id="worker-joined-at"
                type="date"
                value={form.data.joinedAt}
                onChange={(e) => form.setData('joinedAt', e.target.value)}
              />
              {form.errors.joinedAt && (
                <span className="text-xs text-destructive">{form.errors.joinedAt}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="worker-notes">Notes</Label>
              <Textarea
                id="worker-notes"
                value={form.data.notes}
                onChange={(e) => form.setData('notes', e.target.value)}
                rows={4}
              />
              {form.errors.notes && (
                <span className="text-xs text-destructive">{form.errors.notes}</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={form.processing}>
                {form.processing ? 'Saving…' : 'Add worker'}
              </Button>
              <Link href="/workers">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

WorkerNew.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
