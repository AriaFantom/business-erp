import { Data } from '@generated/data'
import { ReactElement, useEffect } from 'react'
import { usePage } from '@inertiajs/react'
import { toast } from 'sonner'

import { Toaster } from '@/components/ui/sonner'

function FlashToasts() {
  const { flash } = usePage<Data.SharedProps>().props

  useEffect(() => {
    if (flash?.success) toast.success(flash.success)
  }, [flash?.success])

  useEffect(() => {
    if (flash?.error) toast.error(flash.error)
  }, [flash?.error])

  return null
}

export default function Layout({ children }: { children: ReactElement<Data.SharedProps> }) {
  return (
    <>
      <main>{children}</main>
      <FlashToasts />
      <Toaster richColors closeButton position="top-right" />
    </>
  )
}
