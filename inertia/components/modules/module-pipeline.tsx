import {
  ClipboardList,
  Cpu,
  Factory,
  FileText,
  HardHat,
  Receipt,
  ShoppingCart,
  Store,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useRef } from 'react'

import { AnimatedBeam } from '@/components/ui/animated-beam'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ModuleDef = {
  key: string
  label: string
  description: string
  stage: 'purchase' | 'manufacturing' | 'inventory' | 'sales' | 'overview'
  parent?: string
  dependsOn: string[]
  routePrefixes: string[]
  icon: string
}

const ICONS: Record<string, LucideIcon> = {
  Warehouse,
  Truck,
  Factory,
  Cpu,
  HardHat,
  ShoppingCart,
  Receipt,
  FileText,
  Store,
  ClipboardList,
}

/** Pipeline stage columns, left-to-right, matching the workflow sketch. */
const STAGE_ORDER: ModuleDef['stage'][] = ['purchase', 'manufacturing', 'inventory', 'sales']

type Props = {
  modules: ModuleDef[]
  selected: Set<string>
  onToggle: (key: string) => void
  /** Labels keyed by module key, e.g. "required by Sales" for forced-off nodes. */
  blockedReason: (key: string) => string | null
}

export function ModulePipeline({ modules, selected, onToggle, blockedReason }: Props) {
  const pipelineRef = useRef<HTMLDivElement>(null)
  const purchaseOutRef = useRef<HTMLSpanElement>(null)
  const manufacturingInRef = useRef<HTMLSpanElement>(null)
  const manufacturingOutRef = useRef<HTMLSpanElement>(null)
  const inventoryInRef = useRef<HTMLSpanElement>(null)
  const inventoryOutRef = useRef<HTMLSpanElement>(null)
  const salesInRef = useRef<HTMLSpanElement>(null)

  const incomingAnchorRefs = [null, manufacturingInRef, inventoryInRef, salesInRef]
  const outgoingAnchorRefs = [purchaseOutRef, manufacturingOutRef, inventoryOutRef, null]

  const byKey = new Map(modules.map((m) => [m.key, m]))
  const labelOf = (key: string) => byKey.get(key)?.label ?? key

  const stageMain = (stage: ModuleDef['stage']) =>
    modules.find((m) => m.stage === stage && !m.parent)
  const stageChips = (stage: ModuleDef['stage']) =>
    modules.filter((m) => m.stage === stage && m.parent)

  const reports = byKey.get('reports')

  return (
    <div className="flex flex-col gap-8">
      <div
        ref={pipelineRef}
        className="relative grid grid-cols-1 items-start gap-4 lg:grid-cols-[repeat(4,minmax(10rem,14rem))] lg:justify-between lg:gap-10 xl:gap-16"
      >
        {STAGE_ORDER.map((stage, i) => {
          const main = stageMain(stage)
          if (!main) return null
          const chips = stageChips(stage)
          const incomingAnchorRef = incomingAnchorRefs[i]
          const outgoingAnchorRef = outgoingAnchorRefs[i]
          return (
            <div key={stage} className="relative z-10 flex min-w-0 flex-col gap-3">
              <div className="relative">
                {incomingAnchorRef && (
                  <span
                    ref={incomingAnchorRef}
                    aria-hidden="true"
                    className="absolute top-1/2 left-0 size-px -translate-y-1/2"
                  />
                )}
                <StageNode
                  module={main}
                  on={selected.has(main.key)}
                  blocked={blockedReason(main.key)}
                  depLabels={main.dependsOn.map(labelOf)}
                  onToggle={() => onToggle(main.key)}
                  className="min-h-48"
                />
                {outgoingAnchorRef && (
                  <span
                    ref={outgoingAnchorRef}
                    aria-hidden="true"
                    className="absolute top-1/2 right-0 size-px -translate-y-1/2"
                  />
                )}
              </div>
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <ChipNode
                      key={chip.key}
                      module={chip}
                      on={selected.has(chip.key)}
                      blocked={blockedReason(chip.key)}
                      depLabels={chip.dependsOn.map(labelOf)}
                      onToggle={() => onToggle(chip.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <AnimatedBeam
          className="hidden lg:block"
          containerRef={pipelineRef}
          fromRef={purchaseOutRef}
          toRef={manufacturingInRef}
          pathColor="var(--border)"
          gradientStartColor="var(--primary)"
          gradientStopColor="var(--muted-foreground)"
          duration={20.25}
        />
        <AnimatedBeam
          className="hidden lg:block"
          containerRef={pipelineRef}
          fromRef={manufacturingOutRef}
          toRef={inventoryInRef}
          pathColor="var(--border)"
          gradientStartColor="var(--primary)"
          gradientStopColor="var(--muted-foreground)"
          delay={0.25}
          duration={20.25}
        />
        <AnimatedBeam
          className="hidden lg:block"
          containerRef={pipelineRef}
          fromRef={inventoryOutRef}
          toRef={salesInRef}
          pathColor="var(--border)"
          gradientStartColor="var(--primary)"
          gradientStopColor="var(--muted-foreground)"
          delay={0.25}
          duration={20.25}
        />
      </div>

      {reports && (
        <div className="flex flex-col gap-5">
          <Separator />
          <div className="flex flex-col gap-1">
            <h3 className="font-medium">Reporting</h3>
            <p className="text-sm text-muted-foreground">
              Reports are configured separately from the operational workflow.
            </p>
          </div>
          <div className="max-w-sm">
            <StageNode
              module={reports}
              on={selected.has(reports.key)}
              blocked={blockedReason(reports.key)}
              depLabels={reports.dependsOn.map(labelOf)}
              onToggle={() => onToggle(reports.key)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

type NodeProps = {
  module: ModuleDef
  on: boolean
  blocked: string | null
  depLabels: string[]
  onToggle: () => void
  className?: string
}

function StageNode({ module, on, blocked, depLabels, onToggle, className }: NodeProps) {
  const Icon = ICONS[module.icon] ?? Warehouse
  const body = (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        'group w-full rounded-xl border p-4 text-left transition',
        on
          ? 'border-primary/40 bg-primary/5 shadow-sm'
          : 'border-dashed border-muted-foreground/30 bg-muted/30 opacity-70 hover:opacity-100',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-lg',
            on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="size-5" />
        </div>
        <Badge variant={on ? 'default' : 'outline'} className="shrink-0">
          {on ? 'On' : 'Off'}
        </Badge>
      </div>
      <div className="mt-3 font-medium">{module.label}</div>
      <p className="mt-1 text-xs text-muted-foreground">{module.description}</p>
      {depLabels.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground/80">
          Requires: {depLabels.join(', ')}
        </p>
      )}
    </button>
  )

  if (blocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{body}</TooltipTrigger>
        <TooltipContent>{blocked}</TooltipContent>
      </Tooltip>
    )
  }
  return body
}

function ChipNode({ module, on, blocked, depLabels, onToggle }: NodeProps) {
  const Icon = ICONS[module.icon] ?? Store
  const chip = (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition',
        on
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-dashed border-muted-foreground/30 text-muted-foreground opacity-70 hover:opacity-100'
      )}
    >
      <Icon className="size-3.5" />
      {module.label}
    </button>
  )

  const reason = blocked ?? (depLabels.length > 0 ? `Requires: ${depLabels.join(', ')}` : null)
  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    )
  }
  return chip
}
