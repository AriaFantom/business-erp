import { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Star, StarOff, Trash2, Upload } from 'lucide-react'
import { Button } from '~/components/ui/button'

export type ProductGalleryImage = {
  id: number
  url: string | null
  originalName: string
  sortOrder: number
  isPrimary: boolean
}

type Props = {
  productId: number
  images: ProductGalleryImage[]
  canEdit: boolean
}

function Tile({
  image,
  productId,
  canEdit,
}: {
  image: ProductGalleryImage
  productId: number
  canEdit: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
      {...attributes}
      {...listeners}
    >
      {image.url ? (
        <img
          src={image.url}
          alt={image.originalName}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          {image.originalName}
        </div>
      )}
      {image.isPrimary && (
        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          Primary
        </span>
      )}
      {canEdit && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-background/80 p-1 opacity-0 transition group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1"
            disabled={image.isPrimary}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              router.post(
                `/catalog/products/${productId}/images/${image.id}/primary`,
                {},
                { preserveScroll: true }
              )
            }}
            title={image.isPrimary ? 'Already primary' : 'Set as primary'}
          >
            {image.isPrimary ? <Star className="h-3 w-3" /> : <StarOff className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1 text-destructive"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (!window.confirm('Delete this image?')) return
              router.post(
                `/catalog/products/${productId}/files/${image.id}/delete`,
                {},
                { preserveScroll: true }
              )
            }}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function ProductImageGallery({ productId, images, canEdit }: Props) {
  const [items, setItems] = useState(images)
  const fileInput = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    setItems(images)
  }, [images])

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    router.post(
      `/catalog/products/${productId}/images/reorder`,
      { items: next.map((row, i) => ({ id: row.id, sortOrder: i + 1 })) },
      { preserveScroll: true }
    )
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !files.length) return
    const fd = new FormData()
    for (const f of Array.from(files)) fd.append('images[]', f)
    router.post(`/catalog/products/${productId}/images`, fd, {
      preserveScroll: true,
      forceFormData: true,
    })
    e.target.value = ''
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((image) => (
              <Tile key={image.id} image={image} productId={productId} canEdit={canEdit} />
            ))}
            {canEdit && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex aspect-square items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-accent"
              >
                <Upload className="h-5 w-5" />
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onPickFiles} />
    </div>
  )
}
