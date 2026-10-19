import { useState, type FormEvent } from 'react'
import { useForm } from '@inertiajs/react'

import { ProductField, type ProductCategoryOption } from '@/components/catalog/new-product-dialog'
import { SkuField } from '@/components/catalog/sku-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function QuickProductDialog({ categories }: { categories: ProductCategoryOption[] }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset, transform, clearErrors } = useForm({
    sku: '',
    name: '',
    categoryId: '',
    image: null as File | null,
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    transform((values) => ({
      sku: values.sku.trim(),
      name: values.name.trim(),
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      image: values.image || undefined,
    }))
    post('/catalog/products', {
      forceFormData: !!data.image,
      preserveScroll: true,
      onSuccess: () => {
        reset()
        setOpen(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Quick add</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick add product</DialogTitle>
          <DialogDescription>
            Add the essentials in one form. Profit and tax use the category defaults.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <ProductField id="quick-product-name" label="Product name" error={errors.name} required>
            <Input
              id="quick-product-name"
              autoFocus
              required
              maxLength={120}
              placeholder="e.g. Crochet Tote Bag"
              value={data.name}
              aria-invalid={!!errors.name}
              onChange={(event) => {
                setData('name', event.target.value)
                clearErrors('name')
              }}
            />
          </ProductField>
          <SkuField
            id="quick-product-sku"
            name={data.name}
            value={data.sku}
            onChange={(sku) => {
              setData('sku', sku)
              clearErrors('sku')
            }}
            error={errors.sku}
          />
          <ProductField id="quick-product-category" label="Category" error={errors.categoryId}>
            <Select
              value={data.categoryId || 'none'}
              onValueChange={(value) => {
                setData('categoryId', value === 'none' ? '' : value)
                clearErrors('categoryId')
              }}
            >
              <SelectTrigger
                id="quick-product-category"
                className="w-full"
                aria-invalid={!!errors.categoryId}
              >
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </ProductField>
          <ProductField id="quick-product-image" label="Product picture" error={errors.image}>
            <Input
              id="quick-product-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-invalid={!!errors.image}
              onChange={(event) => {
                setData('image', event.target.files?.[0] ?? null)
                clearErrors('image')
              }}
            />
            <p className="text-xs text-muted-foreground">
              Optional. PNG, JPEG or WebP, up to 15 MB.
            </p>
          </ProductField>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Creating…' : 'Create product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
