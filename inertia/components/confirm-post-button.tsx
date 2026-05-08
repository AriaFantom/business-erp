import * as React from 'react'
import { useForm } from '@inertiajs/react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Variant = 'default' | 'destructive' | 'outline' | 'success'

type Props = {
  path: string
  label: React.ReactNode
  variant?: Variant
  /** Confirmation prompt — when omitted, the action posts immediately. */
  confirmTitle?: string
  confirmDescription?: React.ReactNode
  confirmLabel?: string
  /** Visual variant for the modal confirm button — defaults to the trigger variant. */
  confirmVariant?: 'destructive' | 'success' | 'default'
  size?: 'sm' | 'default' | 'icon'
  className?: string
  onSuccess?: () => void
}

/**
 * Inertia post button with a shadcn confirm dialog instead of window.confirm.
 * Use anywhere a destructive or state-changing POST needs verification.
 */
export function ConfirmPostButton({
  path,
  label,
  variant = 'default',
  confirmTitle,
  confirmDescription,
  confirmLabel,
  confirmVariant,
  size,
  className,
  onSuccess,
}: Props) {
  const { post, processing } = useForm()
  const [open, setOpen] = React.useState(false)

  const submit = () =>
    post(path, {
      preserveScroll: true,
      onSuccess,
    })

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={processing}
        className={className}
        onClick={() => (confirmTitle ? setOpen(true) : submit())}
      >
        {label}
      </Button>
      {confirmTitle && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={confirmTitle}
          description={confirmDescription}
          confirmLabel={confirmLabel ?? 'Confirm'}
          variant={
            confirmVariant ??
            (variant === 'destructive' ? 'destructive' : 'default')
          }
          onConfirm={submit}
        />
      )}
    </>
  )
}
