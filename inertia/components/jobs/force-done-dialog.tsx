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
              Produced quantity (maximum {plannedQty})
            </Label>
            <Input
              id={`force-done-output-${jobId}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={plannedQty}
              step={1}
              value={producedQty}
              onChange={(event) =>
                setProducedQty(
                  Math.min(plannedQty, Math.max(1, Math.trunc(Number(event.target.value) || 1)))
                )
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep working
          </Button>
          <Button
            type="button"
            disabled={processing}
            onClick={() => {
              setProcessing(true)
              router.post(
                `/jobs/${jobId}/force-done`,
                { ...(setup ?? {}), producedQty },
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
