import { useEffect, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: number
  initialPrice: number | null
  suggestedPrice: number | null
  sourceJob?: { id: number; number: string } | null
  autoComputedPrice?: number | null
}

export function DefaultPriceDialog({
  open,
  onOpenChange,
  productId,
  initialPrice,
  suggestedPrice,
  sourceJob,
  autoComputedPrice,
}: Props) {
  const seed = initialPrice ?? suggestedPrice ?? autoComputedPrice ?? 0
  const [price, setPrice] = useState<string>(String(seed))

  useEffect(() => {
    if (open) setPrice(String(seed))
  }, [open, seed])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(price)
    if (!Number.isFinite(value) || value <= 0) return
    router.post(
      `/catalog/products/${productId}/default-price`,
      { price: value, sourceJobId: sourceJob?.id ?? null },
      {
        preserveScroll: true,
        onSuccess: () => onOpenChange(false),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set default sale price</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="default-price-input">Price (₹)</Label>
            <Input
              id="default-price-input"
              type="number"
              step="0.01"
              placeholder="Selling price per unit"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
          </div>
          {sourceJob && (
            <p className="text-xs text-muted-foreground">Anchored to #{sourceJob.number}</p>
          )}
          {autoComputedPrice !== null && autoComputedPrice !== undefined && (
            <p className="text-xs text-muted-foreground">
              Auto-calculated price: ₹{autoComputedPrice.toLocaleString()}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
