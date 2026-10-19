import { useState, type FormEvent } from 'react'
import { useForm } from '@inertiajs/react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SkuField } from '@/components/catalog/sku-field'
import { cn } from '@/lib/utils'

export type ProductCategoryOption = {
  id: number
  name: string
  defaultProfitPct: string | null
  taxRatePct: string | null
}

type ProductForm = {
  sku: string
  name: string
  description: string
  categoryId: string
  defaultProfitPct: string
  taxRatePct: string
}

type FormErrors = Partial<Record<keyof ProductForm, string>>

const steps = [
  { label: 'Basics', description: 'Name, SKU and category' },
  { label: 'Details', description: 'Description and percentages' },
  { label: 'Review', description: 'Check before creating' },
] as const

function validateBasics(data: ProductForm): FormErrors {
  const errors: FormErrors = {}
  const name = data.name.trim()
  const sku = data.sku.trim()

  if (!name) errors.name = 'Enter a product name.'
  else if (name.length > 120) errors.name = 'Keep the name within 120 characters.'

  if (!sku) errors.sku = 'Enter or generate a SKU.'
  else if (sku.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku)) {
    errors.sku = 'Use up to 64 letters, numbers, dots, underscores or hyphens.'
  }

  return errors
}

function validateDetails(data: ProductForm): FormErrors {
  const errors: FormErrors = {}
  if (data.description.trim().length > 2000) {
    errors.description = 'Keep the description within 2,000 characters.'
  }

  for (const key of ['defaultProfitPct', 'taxRatePct'] as const) {
    const value = data[key].trim()
    if (value && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) {
      errors[key] = 'Enter a percentage from 0 to 100.'
    }
  }

  return errors
}

export function NewProductDialog({ categories }: { categories: ProductCategoryOption[] }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [clientErrors, setClientErrors] = useState<FormErrors>({})
  const { data, setData, post, processing, errors, reset, transform, clearErrors } =
    useForm<ProductForm>({
      sku: '',
      name: '',
      description: '',
      categoryId: '',
      defaultProfitPct: '',
      taxRatePct: '',
    })

  function update<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setData((previous) => ({ ...previous, [key]: value }))
    setClientErrors((previous) => ({ ...previous, [key]: undefined }))
    clearErrors(key)
  }

  function moveForward() {
    const nextErrors = step === 0 ? validateBasics(data) : validateDetails(data)
    if (Object.keys(nextErrors).length > 0) {
      setClientErrors(nextErrors)
      return
    }
    setClientErrors({})
    setStep(step + 1)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < steps.length - 1) {
      moveForward()
      return
    }

    const basicErrors = validateBasics(data)
    const detailErrors = validateDetails(data)
    if (Object.keys(basicErrors).length > 0) {
      setClientErrors(basicErrors)
      setStep(0)
      return
    }
    if (Object.keys(detailErrors).length > 0) {
      setClientErrors(detailErrors)
      setStep(1)
      return
    }

    transform((values) => ({
      sku: values.sku.trim(),
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      defaultProfitPct: values.defaultProfitPct ? Number(values.defaultProfitPct) : undefined,
      taxRatePct: values.taxRatePct ? Number(values.taxRatePct) : undefined,
    }))
    post('/catalog/products', {
      preserveScroll: true,
      onSuccess: () => {
        reset()
        setClientErrors({})
        setStep(0)
        setOpen(false)
      },
      onError: (serverErrors) => {
        if (serverErrors.sku || serverErrors.name || serverErrors.categoryId) setStep(0)
        else setStep(1)
      },
    })
  }

  const category = categories.find((item) => String(item.id) === data.categoryId)
  const errorFor = (key: keyof ProductForm) => clientErrors[key] || errors[key]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New product</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create product</DialogTitle>
          <DialogDescription>
            Add the essentials first, then fill in optional details and review your product.
          </DialogDescription>
        </DialogHeader>

        <ol aria-label="Product creation steps" className="grid grid-cols-3 gap-2">
          {steps.map((item, index) => (
            <li
              key={item.label}
              aria-current={step === index ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-md border p-2 text-sm',
                step === index && 'border-primary bg-primary/5',
                step > index && 'text-muted-foreground'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs',
                  step >= index && 'bg-primary text-primary-foreground'
                )}
              >
                {step > index ? <Check className="size-3" /> : index + 1}
              </span>
              <span className="truncate font-medium">{item.label}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
          <div className="flex flex-col gap-1">
            <h3 className="font-medium">{steps[step].label}</h3>
            <p className="text-sm text-muted-foreground">{steps[step].description}</p>
          </div>

          <div className={cn('flex-col gap-4', step === 0 ? 'flex' : 'hidden')}>
            <ProductField id="product-name" label="Product name" error={errorFor('name')} required>
              <Input
                id="product-name"
                maxLength={120}
                placeholder="e.g. Crochet Tote Bag"
                value={data.name}
                aria-invalid={!!errorFor('name')}
                onChange={(event) => update('name', event.target.value)}
              />
            </ProductField>
            <SkuField
              id="product-sku"
              name={data.name}
              value={data.sku}
              onChange={(sku) => update('sku', sku)}
              error={errorFor('sku')}
            />
            <ProductField id="product-category" label="Category" error={errorFor('categoryId')}>
              <Select
                value={data.categoryId || 'none'}
                onValueChange={(value) => {
                  update('categoryId', value === 'none' ? '' : value)
                  const selectedCategory = categories.find((item) => String(item.id) === value)
                  if (selectedCategory) {
                    update('defaultProfitPct', selectedCategory.defaultProfitPct ?? '')
                    update('taxRatePct', selectedCategory.taxRatePct ?? '')
                  }
                }}
              >
                <SelectTrigger
                  id="product-category"
                  className="w-full"
                  aria-invalid={!!errorFor('categoryId')}
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
          </div>

          <div className={cn('flex-col gap-4', step === 1 ? 'flex' : 'hidden')}>
            <ProductField
              id="product-description"
              label="Description"
              error={errorFor('description')}
            >
              <Textarea
                id="product-description"
                rows={4}
                maxLength={2000}
                className="resize-y"
                placeholder="Materials, size, finish or other useful details"
                value={data.description}
                aria-invalid={!!errorFor('description')}
                onChange={(event) => update('description', event.target.value)}
              />
            </ProductField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProductField
                id="product-profit"
                label="Default profit %"
                error={errorFor('defaultProfitPct')}
              >
                <Input
                  id="product-profit"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="e.g. 30"
                  value={data.defaultProfitPct}
                  aria-invalid={!!errorFor('defaultProfitPct')}
                  onChange={(event) => update('defaultProfitPct', event.target.value)}
                />
              </ProductField>
              <ProductField id="product-tax" label="Tax rate %" error={errorFor('taxRatePct')}>
                <Input
                  id="product-tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="e.g. 18"
                  value={data.taxRatePct}
                  aria-invalid={!!errorFor('taxRatePct')}
                  onChange={(event) => update('taxRatePct', event.target.value)}
                />
              </ProductField>
            </div>
            <p className="text-xs text-muted-foreground">
              These percentages are optional. Selecting a category fills its defaults, and you can
              adjust them here.
            </p>
          </div>

          {step === 2 && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
              <ReviewItem label="Product name" value={data.name.trim()} />
              <ReviewItem label="SKU" value={data.sku.trim()} />
              <ReviewItem label="Category" value={category?.name ?? 'No category'} />
              <ReviewItem
                label="Default profit"
                value={data.defaultProfitPct ? `${data.defaultProfitPct}%` : 'Not set'}
              />
              <ReviewItem
                label="Tax rate"
                value={data.taxRatePct ? `${data.taxRatePct}%` : 'Not set'}
              />
              <ReviewItem label="Description" value={data.description.trim() || 'Not added'} />
            </dl>
          )}

          <DialogFooter className="flex-row justify-between sm:justify-between">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={processing}
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={processing}>
              {step === steps.length - 1
                ? processing
                  ? 'Creating…'
                  : 'Create product'
                : 'Continue'}
              {step < steps.length - 1 && <ArrowRight data-icon="inline-end" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProductField({
  id,
  label,
  error,
  required = false,
  children,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5" data-invalid={!!error || undefined}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  )
}
