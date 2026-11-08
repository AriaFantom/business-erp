import { useEffect, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  kind: 'product' | 'component'
  id: number
  name: string
  sku: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditItemNameDialog({ kind, id, name, sku, open, onOpenChange }: Props) {
  const [initialName, setInitialName] = useState(name)
  const { data, setData, post, processing, errors, reset } = useForm({ name })

  useEffect(() => {
    if (!open) return
    setInitialName(name)
    setData('name', name)
  }, [open, id, name])

  const label = kind === 'product' ? 'product' : 'component'
  const path = kind === 'product' ? 'products' : 'components'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {label} name</DialogTitle>
          <DialogDescription>The SKU is permanent and will not change.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            post(`/catalog/${path}/${id}`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                onOpenChange(false)
              },
            })
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${kind}-edit-name`}>Name</Label>
            <Input
              id={`${kind}-edit-name`}
              autoFocus
              required
              maxLength={120}
              value={data.name}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => setData('name', event.target.value)}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${kind}-edit-sku`}>SKU (read only)</Label>
            <Input id={`${kind}-edit-sku`} value={sku} readOnly className="font-mono" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={processing || !data.name.trim() || data.name.trim() === initialName}
            >
              {processing ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
