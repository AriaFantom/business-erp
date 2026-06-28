import { useEffect, useState, type ComponentType } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ActiveMachinesWidget,
  ExpensesBySectorWidget,
  ProfitTrendWidget,
  SalesVsPurchaseWidget,
  TopCustomersWidget,
  TopProductsWidget,
  type DashboardData,
} from '@/components/dashboard/widgets'

type WidgetDef = {
  id: string
  title: string
  description: string
  span: 'half' | 'full'
  Component: ComponentType<{ data: DashboardData }>
}

// Registry — also defines the default order. New widgets append here.
const WIDGETS: WidgetDef[] = [
  {
    id: 'sales-vs-purchase',
    title: 'Gross sales vs purchase',
    description: 'Monthly confirmed sales and purchase totals',
    span: 'full',
    Component: SalesVsPurchaseWidget,
  },
  {
    id: 'profit-trend',
    title: 'Profit trend',
    description: 'Revenue, cost and profit by month',
    span: 'full',
    Component: ProfitTrendWidget,
  },
  {
    id: 'top-customers',
    title: 'Top customers',
    description: 'Highest spenders in the selected range',
    span: 'half',
    Component: TopCustomersWidget,
  },
  {
    id: 'top-products',
    title: 'Top selling products',
    description: 'By quantity sold',
    span: 'half',
    Component: TopProductsWidget,
  },
  {
    id: 'expenses-by-sector',
    title: 'Expenses by sector',
    description: 'Spend per expense kind',
    span: 'half',
    Component: ExpensesBySectorWidget,
  },
  {
    id: 'active-machines',
    title: 'Active printing machines',
    description: 'Live machine status',
    span: 'half',
    Component: ActiveMachinesWidget,
  },
]

const STORAGE_KEY = 'dashboard.widgetOrder'

function loadOrder(): string[] {
  const ids = WIDGETS.map((w) => w.id)
  if (typeof window === 'undefined') return ids
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as string[] | null
    if (!Array.isArray(saved)) return ids
    // Keep saved order, drop unknown ids, append any new widgets at the end.
    const known = saved.filter((id) => ids.includes(id))
    const missing = ids.filter((id) => !known.includes(id))
    return [...known, ...missing]
  } catch {
    return ids
  }
}

function SortableWidget({ def, data }: { def: WidgetDef; data: DashboardData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.id,
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
      className={cn(def.span === 'full' ? 'lg:col-span-2' : 'lg:col-span-1', isDragging && 'z-10')}
    >
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{def.title}</CardTitle>
              <CardDescription>{def.description}</CardDescription>
            </div>
            <button
              type="button"
              className="-mr-1 cursor-grab rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <def.Component data={data} />
        </CardContent>
      </Card>
    </div>
  )
}

export function DashboardGrid({ data }: { data: DashboardData }) {
  const [order, setOrder] = useState<string[]>(() => WIDGETS.map((w) => w.id))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  // Hydrate order from localStorage on mount (avoids SSR/client mismatch).
  useEffect(() => {
    setOrder(loadOrder())
  }, [])

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)))
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore quota/availability errors */
      }
      return next
    })
  }

  const byId = new Map(WIDGETS.map((w) => [w.id, w]))
  const ordered = order.map((id) => byId.get(id)).filter((w): w is WidgetDef => Boolean(w))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ordered.map((def) => (
            <SortableWidget key={def.id} def={def} data={data} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
