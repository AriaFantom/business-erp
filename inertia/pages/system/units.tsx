import { Head, router, useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useState, type ReactElement } from 'react'
import DashboardLayout from '@/layouts/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

type Unit = {
  id: number
  categoryId: number
  category: string
  code: string
  name: string
  factor: string
  reference: boolean
  active: boolean
  locked: boolean
}
const path = '/system/settings/units'
const cleanFactor = (value: string) =>
  value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value

function EditUnit({ unit, reference }: { unit: Unit; reference: string }) {
  const form = useForm({
    name: unit.name,
    active: unit.active,
    factor: unit.locked ? undefined : cleanFactor(unit.factor),
  })
  return (
    <form
      className="flex flex-wrap items-end gap-3 border-t py-3"
      onSubmit={(event) => {
        event.preventDefault()
        form.patch(`${path}/${unit.id}`, {
          preserveScroll: true,
          preserveState: false,
          onSuccess: () => router.flushAll(),
        })
      }}
    >
      <div className="min-w-36 flex-1">
        <Label htmlFor={`unit-name-${unit.id}`}>
          {unit.code} {unit.reference ? '· Reference' : unit.locked ? '· Locked' : ''}
        </Label>
        <Input
          id={`unit-name-${unit.id}`}
          value={form.data.name}
          onChange={(event) => form.setData('name', event.target.value)}
          required
          maxLength={80}
        />
        {form.errors.name && <p className="text-sm text-destructive">{form.errors.name}</p>}
      </div>
      {unit.locked ? (
        <p className="text-sm text-muted-foreground">
          1 {unit.code} = {cleanFactor(unit.factor)} {reference}
        </p>
      ) : (
        <div className="w-36">
          <Label htmlFor={`unit-factor-${unit.id}`}>
            {reference} per {unit.code}
          </Label>
          <Input
            id={`unit-factor-${unit.id}`}
            value={form.data.factor ?? ''}
            onChange={(event) => form.setData('factor', event.target.value)}
            inputMode="decimal"
            required
          />
          {form.errors.factor && <p className="text-sm text-destructive">{form.errors.factor}</p>}
        </div>
      )}
      {!unit.reference && (
        <Label className="h-9 gap-2">
          <input
            type="checkbox"
            checked={form.data.active}
            onChange={(event) => form.setData('active', event.target.checked)}
          />
          Active
        </Label>
      )}
      <Button size="sm" variant="outline" disabled={!form.isDirty || form.processing}>
        Save
      </Button>
    </form>
  )
}

export default function UnitsSettings({ units }: { units: Unit[] }) {
  const [search, setSearch] = useState('')
  const [newCategory, setNewCategory] = useState(false)
  const form = useForm({ name: '', code: '', factor: '1', categoryId: '', categoryName: '' })
  const references = units.filter((unit) => unit.reference)
  const reference = references.find((unit) => unit.categoryId === Number(form.data.categoryId))
  const query = search.trim().toLowerCase()
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <Head title="Units settings" />
      <h1 className="text-2xl font-semibold">Settings</h1>
      <nav aria-label="Settings sections" className="flex gap-4 text-sm">
        <Link href="/system/settings" className="text-muted-foreground hover:text-foreground">
          Application
        </Link>
        <Link href={path} aria-current="page" className="font-semibold">
          Units
        </Link>
      </nav>
      <Card>
        <CardHeader>
          <CardTitle>Add a unit</CardTitle>
          <CardDescription>
            Define one relationship to the category’s reference unit. Used conversions cannot be
            changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              form.transform((data) => ({
                name: data.name,
                code: data.code.trim().toLowerCase(),
                ...(newCategory
                  ? { categoryName: data.categoryName, factor: '1' }
                  : { categoryId: data.categoryId, factor: data.factor }),
              }))
              form.post(path, { preserveState: false, onSuccess: () => router.flushAll() })
            }}
          >
            <Label className="gap-2">
              <input
                type="checkbox"
                checked={newCategory}
                onChange={(event) => setNewCategory(event.target.checked)}
              />
              Create a category with this unit as its reference
            </Label>
            {newCategory ? (
              <Label className="flex-col items-start gap-1">
                Category name
                <Input
                  value={form.data.categoryName}
                  onChange={(event) => form.setData('categoryName', event.target.value)}
                  required
                  maxLength={80}
                />
              </Label>
            ) : (
              <Select
                value={form.data.categoryId}
                onValueChange={(value) => form.setData('categoryId', value)}
              >
                <SelectTrigger aria-label="Category" className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {references.map((unit) => (
                      <SelectItem key={unit.id} value={String(unit.categoryId)}>
                        {unit.category}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <div className="flex flex-wrap gap-3">
              <Label className="min-w-36 flex-1 flex-col items-start gap-1">
                Unit name
                <Input
                  value={form.data.name}
                  onChange={(event) => form.setData('name', event.target.value)}
                  required
                  maxLength={80}
                />
              </Label>
              <Label className="min-w-36 flex-1 flex-col items-start gap-1">
                Unit code
                <Input
                  value={form.data.code}
                  onChange={(event) => form.setData('code', event.target.value)}
                  required
                  maxLength={16}
                  placeholder="e.g. pack6"
                />
              </Label>
              {!newCategory && (
                <Label className="min-w-36 flex-1 flex-col items-start gap-1">
                  Reference units per unit
                  <Input
                    value={form.data.factor}
                    onChange={(event) => form.setData('factor', event.target.value)}
                    required
                    inputMode="decimal"
                  />
                </Label>
              )}
            </div>
            {reference && !newCategory && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                1 {form.data.code || 'new unit'} = {form.data.factor} {reference.code}
              </p>
            )}
            {Object.values(form.errors).map((error, index) => (
              <p key={index} className="text-sm text-destructive">
                {error}
              </p>
            ))}
            <div>
              <Button disabled={form.processing || (!newCategory && !reference)}>
                {newCategory ? 'Create category' : 'Add unit'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Input
        aria-label="Search units and categories"
        placeholder="Search units and categories…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {references.map((referenceUnit) => {
        const matches = units.filter(
          (unit) =>
            unit.categoryId === referenceUnit.categoryId &&
            [unit.code, unit.name, unit.category].some((value) =>
              value.toLowerCase().includes(query)
            )
        )
        if (!matches.length) return null
        return (
          <Card key={referenceUnit.id}>
            <CardHeader>
              <CardTitle>{referenceUnit.category}</CardTitle>
              <CardDescription>
                Reference: {referenceUnit.name} ({referenceUnit.code})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {matches.map((unit) => (
                <EditUnit key={unit.id} unit={unit} reference={referenceUnit.code} />
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

UnitsSettings.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
