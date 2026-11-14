import { useState } from 'react'
import { router } from '@inertiajs/react'
import type { FormDataConvertible } from '@inertiajs/core'
import { Button } from '@/components/ui/button'
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
import { formatDuration } from '@/components/jobs/job-stages-repeater'
import { useMeasurementUnits } from '@/lib/quantity_units'
import { QuantityUnitSelect } from '@/components/catalog/quantity-unit-select'

export function ForceDoneDialog({
  jobId,
  plannedQty,
  configuredMinutes,
  setup,
  disabled = false,
  size,
}: {
  jobId: number
  plannedQty: number
  configuredMinutes: number
  setup?: Record<string, FormDataConvertible>
  disabled?: boolean
  size?: 'sm' | 'default'
}) {
  const [open, setOpen] = useState(false)
  const [producedQty, setProducedQty] = useState(plannedQty)
  const [unit, setUnit] = useState('pcs')
  const { convertDisplayQuantity } = useMeasurementUnits()
  const pieces = convertDisplayQuantity(producedQty, unit, 'pcs')
  const [processing, setProcessing] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={disabled}>
          Force done
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete this job now?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This posts finished stock now and charges the full configured duration of{' '}
            <strong className="text-foreground">{formatDuration(configuredMinutes)}</strong>.
            Materials are consumed once; active jobs will not deduct them again.
          </p>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`force-done-output-${jobId}`}>
              Produced quantity (maximum {plannedQty} pieces)
            </Label>
            <div className="flex gap-2">
              <Input
                id={`force-done-output-${jobId}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={producedQty}
                onChange={(event) => setProducedQty(Number(event.target.value))}
              />
              <QuantityUnitSelect
                value={unit}
                onChange={(next) => {
                  setProducedQty(Number(convertDisplayQuantity(producedQty, unit, next).toFixed(9)))
                  setUnit(next)
                }}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep working
          </Button>
          <Button
            type="button"
            disabled={processing || pieces <= 0 || pieces > plannedQty}
            onClick={() => {
              setProcessing(true)
              router.post(
                `/jobs/${jobId}/force-done`,
                { ...(setup ?? {}), producedQty, unit },
                {
                  preserveScroll: true,
                  onSuccess: () => setOpen(false),
                  onFinish: () => setProcessing(false),
                }
              )
            }}
          >
            {processing ? 'Completing…' : 'Complete and post stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
