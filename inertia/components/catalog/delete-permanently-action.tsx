import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'

export function DeletePermanentlyAction({ path, name }: { path: string; name: string }) {
  const [open, setOpen] = useState(false)
  const { post, processing } = useForm()

  return (
    <>
      <Button
        type="button"
        variant="destructive-soft"
        size="icon"
        disabled={processing}
        aria-label={`Delete ${name} permanently`}
        title="Delete permanently"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${name} permanently?`}
        description="This is only allowed when no business history exists. This action cannot be undone."
        confirmLabel="Delete permanently"
        variant="destructive"
        onConfirm={() => post(path, { preserveScroll: true })}
      />
    </>
  )
}
