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
