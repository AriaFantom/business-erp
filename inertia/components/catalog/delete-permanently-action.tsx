import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'

export function DeletePermanentlyAction({
  path,
  name,
  blockedReason,
}: {
  path: string
  name: string
  blockedReason: string | null
}) {
  const [open, setOpen] = useState(false)
  const { post, processing } = useForm()
  const blocked = Boolean(blockedReason)

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="destructive-soft"
        size="sm"
        disabled={processing || blocked}
        title={
          blockedReason ? `${blockedReason} Archive or retire this record instead.` : undefined
        }
        onClick={() => setOpen(true)}
      >
        <Trash2 data-icon="inline-start" />
        Delete permanently
      </Button>
      {blockedReason && (
        <span className="max-w-56 text-right text-xs text-muted-foreground">
          Can’t delete: {blockedReason}
        </span>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${name} permanently?`}
        description="This is only allowed when no business history exists. This action cannot be undone."
        confirmLabel="Delete permanently"
        variant="destructive"
        onConfirm={() => post(path, { preserveScroll: true })}
      />
    </div>
  )
}
