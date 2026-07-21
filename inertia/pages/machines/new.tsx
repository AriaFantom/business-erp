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
import { Textarea } from '@/components/ui/textarea'
import DashboardLayout from '@/layouts/dashboard-layout'

export default function MachineNew() {
  const form = useForm({ name: '', model: '', serialNumber: '', notes: '', hourlyRate: '0' })

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <Head title="Add machine" />
      <div>
        <Link
          href="/machines"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to machines
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add machine</h1>
        <p className="text-sm text-muted-foreground">
          Register a machine so jobs can be assigned to it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Machine details</CardTitle>
          <CardDescription>Only the name is required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              form.post('/machines')
            }}
          >
            <Field
              label="Name"
              required
              value={form.data.name}
              error={form.errors.name}
              onChange={(v) => form.setData('name', v)}
            />
            <Field
              label="Model"
              value={form.data.model}
              error={form.errors.model}
              onChange={(v) => form.setData('model', v)}
            />
            <Field
              label="Serial number"
              value={form.data.serialNumber}
              error={form.errors.serialNumber}
              onChange={(v) => form.setData('serialNumber', v)}
            />
            <div className="flex flex-col gap-1">
              <Label>Notes</Label>
              <Textarea
                value={form.data.notes}
                onChange={(e) => form.setData('notes', e.target.value)}
                rows={4}
              />
              {form.errors.notes && (
                <span className="text-xs text-destructive">{form.errors.notes}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label>Hourly rate</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.data.hourlyRate}
                onChange={(e) => form.setData('hourlyRate', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cost per machine-hour (electricity + depreciation + upkeep) — folded into job cost
                from actual run time.
              </p>
              {form.errors.hourlyRate && (
                <span className="text-xs text-destructive">{form.errors.hourlyRate}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={form.processing}>
                {form.processing ? 'Saving…' : 'Add machine'}
              </Button>
              <Link href="/machines">
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

function Field({
  label,
  value,
  error,
  onChange,
  required,
}: {
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

MachineNew.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
