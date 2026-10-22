import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { router, useForm, usePage } from '@inertiajs/react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { ConfirmDialog } from '@/components/confirm-dialog'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import DashboardLayout from '@/layouts/dashboard-layout'
import type { InertiaProps } from '@/types'

type RoleOption = {
  id: number
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  rankPosition: number
  permissions: string[]
  assignable: boolean
  reorderable: boolean
}

type PermissionOption = {
  key: string
  description: string
}

type RolesPageProps = {
  roles: RoleOption[]
  permissionCatalog: PermissionOption[]
}

function groupPermissions(catalog: PermissionOption[]): Array<[string, PermissionOption[]]> {
  const groups: Record<string, PermissionOption[]> = {}
  for (const p of catalog) {
    const [resource] = p.key.split('.')
    if (!groups[resource]) groups[resource] = []
    groups[resource].push(p)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

function CreateRoleCard({ permissionCatalog }: { permissionCatalog: PermissionOption[] }) {
  const { data, setData, post, processing, errors, reset } = useForm({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[],
  })

  const grouped = useMemo(() => groupPermissions(permissionCatalog), [permissionCatalog])

  const togglePermission = (key: string, checked: boolean) => {
    setData(
      'permissions',
      checked ? [...data.permissions, key] : data.permissions.filter((k) => k !== key)
    )
  }

  const toggleGroup = (groupKeys: string[], checked: boolean) => {
    const set = new Set(data.permissions)
    if (checked) groupKeys.forEach((k) => set.add(k))
    else groupKeys.forEach((k) => set.delete(k))
    setData('permissions', [...set])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create role</CardTitle>
        <CardDescription>
          Choose what the new role can do. It starts at the bottom of the ranking.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          post('/roles', {
            preserveScroll: true,
            preserveState: false,
            onSuccess: () => {
              router.flushAll()
              reset()
            },
          })
        }}
      >
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">Slug</Label>
              <Input
                id="role-name"
                name="name"
                value={data.name}
                onChange={(e) => setData('name', e.target.value)}
                placeholder="editor"
                aria-invalid={errors.name ? true : undefined}
                required
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-display-name">Display name</Label>
              <Input
                id="role-display-name"
                name="displayName"
                value={data.displayName}
                onChange={(e) => setData('displayName', e.target.value)}
                placeholder="Editor"
                aria-invalid={errors.displayName ? true : undefined}
                required
              />
              {errors.displayName && (
                <p className="text-sm text-destructive">{errors.displayName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                name="description"
                rows={3}
                className="resize-none"
                value={data.description}
                onChange={(e) => setData('description', e.target.value)}
                placeholder="What does this role do?"
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Permissions</Label>
              <span className="text-xs text-muted-foreground">
                {data.permissions.length} selected
              </span>
            </div>

            <div className="flex flex-col gap-4 rounded-md border border-border p-4">
              {grouped.map(([resource, items], index) => {
                const groupKeys = items.map((i) => i.key)
                const allChecked = groupKeys.every((k) => data.permissions.includes(k))
                return (
                  <div key={resource} className="flex flex-col gap-2">
                    {index > 0 && <Separator />}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-sm font-medium capitalize">{resource}</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleGroup(groupKeys, !allChecked)}
                      >
                        {allChecked ? 'Clear' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {items.map((p) => {
                        const checked = data.permissions.includes(p.key)
                        return (
                          <label
                            key={p.key}
                            className="flex cursor-pointer items-start gap-2 rounded-sm py-1 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => togglePermission(p.key, value === true)}
                              className="mt-0.5"
                            />
                            <span className="flex flex-col">
                              <span className="font-mono text-xs text-muted-foreground">
                                {p.key}
                              </span>
                              <span className="text-sm">{p.description}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            {errors.permissions && <p className="text-sm text-destructive">{errors.permissions}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={processing}>
            <Plus />
            {processing ? 'Creating…' : 'Create role'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function SortableRole({
  role,
  position,
  canDelete,
}: {
  role: RoleOption
  position: number
  canDelete: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: role.id,
    disabled: !role.reorderable,
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">
          {position}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{role.displayName}</span>
            <span className="font-mono text-xs text-muted-foreground">{role.name}</span>
            {role.isSystem && <Badge variant="secondary">system</Badge>}
            {role.assignable && <Badge variant="outline">below your rank</Badge>}
          </div>
          {role.description && (
            <span className="text-xs text-muted-foreground">{role.description}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canDelete && !role.isSystem && role.assignable && (
          <DeleteRoleButton roleId={role.id} roleName={role.displayName} />
        )}
        {role.reorderable ? (
          <button
            type="button"
            aria-label={`Drag ${role.displayName} to change rank`}
            className="cursor-grab rounded p-2 text-muted-foreground hover:bg-accent active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <span className="size-8" aria-hidden />
        )}
      </div>
    </div>
  )
}

export default function SystemRoles({ roles, permissionCatalog }: RolesPageProps) {
  const { user } = usePage<InertiaProps<RolesPageProps>>().props
  const originalIds = useMemo(() => roles.map((role) => role.id), [roles])
  const [order, setOrder] = useState<number[]>(originalIds)
  const [saving, setSaving] = useState(false)
  useEffect(() => setOrder(originalIds), [originalIds])
  const byId = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles])
  const orderedRoles = order
    .map((id) => byId.get(id))
    .filter((role): role is RoleOption => Boolean(role))
  const changed = order.some((id, index) => id !== originalIds[index])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.indexOf(Number(active.id)), order.indexOf(Number(over.id)))
    if (
      next.some(
        (id, index) => !byId.get(originalIds[index])?.reorderable && id !== originalIds[index]
      )
    )
      return
    setOrder(next)
  }

  function saveOrder() {
    setSaving(true)
    router.post(
      '/roles/reorder',
      { orderedIds: order, originalIds },
      {
        preserveScroll: true,
        preserveState: false,
        onSuccess: () => router.flushAll(),
        onFinish: () => setSaving(false),
      }
    )
  }

  const can = (key: string): boolean => {
    if (!user) return false
    if (user.isOwner) return true
    return user.permissions?.includes(key) ?? false
  }

  const canCreateRole = can('roles.create')
  const canDeleteRole = can('roles.delete')
  const canReorder = can('roles.update') && roles.some((role) => role.reorderable)

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Role Management</h1>
        <p className="text-sm text-muted-foreground">
          Higher roles can manage users and roles below them. Feature permissions remain separate.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Role ranking</CardTitle>
            <CardDescription>
              Highest first. Drag a handle to preview a new ranking, then save it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                {orderedRoles.map((role, index) => (
                  <SortableRole
                    key={role.id}
                    role={role}
                    position={index + 1}
                    canDelete={canDeleteRole}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </CardContent>
          {canReorder && (
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={!changed || saving}
                onClick={() => setOrder(originalIds)}
              >
                Reset
              </Button>
              <Button disabled={!changed || saving} onClick={saveOrder}>
                {saving ? 'Saving…' : 'Save order'}
              </Button>
            </CardFooter>
          )}
        </Card>
        {canCreateRole && <CreateRoleCard permissionCatalog={permissionCatalog} />}
      </div>
    </div>
  )
}

function DeleteRoleButton({ roleId, roleName }: { roleId: number; roleName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete role "${roleName}"?`}
        description="The role will be removed and any users assigned to it will lose those permissions."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() =>
          router.post(
            `/roles/${roleId}/delete`,
            {},
            {
              preserveScroll: true,
              preserveState: false,
              onSuccess: () => router.flushAll(),
            }
          )
        }
      />
    </>
  )
}

SystemRoles.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
