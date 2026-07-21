import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { QrCode, Download } from 'lucide-react'

type Props = {
  productId: number
  productName: string
}

export function ProductQrDialog({ productId, productName }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="View QR code">
          <QrCode className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR code — {productName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {open ? (
            <img
              src={`/catalog/products/${productId}/qr`}
              alt={`QR code for ${productName}`}
              className="h-64 w-64 rounded border bg-white object-contain p-2"
            />
          ) : null}
          <p className="text-xs text-muted-foreground">Scan to open this product's detail page.</p>
          <Button asChild>
            <a href={`/catalog/products/${productId}/qr/download`}>
              <Download className="size-4" />
              Download PNG
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
