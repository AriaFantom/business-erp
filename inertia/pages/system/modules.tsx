import { useMemo, useState, type ReactElement } from 'react'
import { router, usePage } from '@inertiajs/react'
import {
  Boxes,
  Factory,
  Hammer,
  RotateCcw,
  ShoppingBag,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/confirm-dialog'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ModulePipeline, type ModuleDef } from '@/components/modules/module-pipeline'
import { cn } from '@/lib/utils'
import type { InertiaProps } from '@/types'

type Preset = { key: string; label: string; description: string; modules: string[] }

type PageProps = InertiaProps<{
  modules: ModuleDef[]
  presets: Preset[]
  enabled: string[]
}>

const PRESET_ICONS: Record<string, LucideIcon> = {
  wholesale: Boxes,
  manufacturer: Factory,
  artisan: Hammer,
  retail: ShoppingBag,
}

export default function ModulesSettings() {
  const { modules, presets, enabled } = usePage<PageProps>().props

  const byKey = useMemo(() => new Map(modules.map((m) => [m.key, m])), [modules])
  const labelOf = (key: string) => byKey.get(key)?.label ?? key

  const [selected, setSelected] = useState<Set<string>>(() => new Set(enabled))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Cascade: turning a dependency off also turns off anything that needs it.
  function cascadeDisable(input: Set<string>): Set<string> {
    const set = new Set(input)
    let changed = true
    while (changed) {
      changed = false
      for (const key of [...set]) {
        const deps = byKey.get(key)?.dependsOn ?? []
        if (deps.some((d) => !set.has(d))) {
          set.delete(key)
          changed = true
        }
      }
    }
    return set
  }

  // Closure: turning a module on also pulls in everything it depends on.
  function closureEnable(input: Set<string>): Set<string> {
    const set = new Set(input)
    let changed = true
    while (changed) {
      changed = false
      for (const key of [...set]) {
        for (const dep of byKey.get(key)?.dependsOn ?? []) {
          if (!set.has(dep)) {
            set.add(dep)
            changed = true
          }
        }
      }
    }
    return set
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        return cascadeDisable(next)
      }
      next.add(key)
      return closureEnable(next)
    })
  }

  function applyPreset(preset: Preset) {
    setSelected(closureEnable(new Set(preset.modules)))
  }

  const activePreset =
    presets.find((preset) => {
      const presetModules = closureEnable(new Set(preset.modules))
      return (
        presetModules.size === selected.size && [...presetModules].every((key) => selected.has(key))
      )
    })?.key ?? ''

  function reset() {
    setSelected(new Set(enabled))
  }

  function blockedReason(key: string): string | null {
    if (selected.has(key)) return null
    const missing = (byKey.get(key)?.dependsOn ?? []).filter((d) => !selected.has(d))
    return missing.length > 0 ? `Enable ${missing.map(labelOf).join(', ')} first` : null
  }

  const enabledSet = useMemo(() => new Set(enabled), [enabled])
  const dirty = selected.size !== enabledSet.size || [...selected].some((k) => !enabledSet.has(k))

  const turningOff = enabled.filter((k) => !selected.has(k))
  const turningOn = [...selected].filter((k) => !enabledSet.has(k))

  function save() {
    setSaving(true)
    router.post(
      '/system/modules',
      { enabledModules: Array.from(selected) },
      {
        // A module update changes both this page and the persistent navigation.
        // Recreate the page from the redirect props instead of keeping the
        // pre-save React state that Inertia preserves for POST requests.
        preserveState: false,
        preserveScroll: true,
        onSuccess: () => {
          // Module-gated destinations may have been prefetched while they were
          // enabled. Do not let those stale pages survive a configuration change.
          router.flushAll()
        },
        onFinish: () => {
          setSaving(false)
          setConfirmOpen(false)
        },
      }
    )
  }

  return (
    <TooltipProvider>
      <div className="flex w-full min-w-0 flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <SlidersHorizontal className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold">Modules</h1>
              <p className="text-sm text-muted-foreground">
                Turn business modules on or off to match your workflow. Disabled modules are hidden
                from navigation and blocked — your data is preserved and returns when you re-enable
                them.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            {dirty && (
              <Button variant="ghost" onClick={reset} disabled={saving}>
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
            )}
            <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || saving}>
              Save changes
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle id="module-presets-heading">Presets</CardTitle>
            <CardDescription>
              Start from a common business setup, then customize individual modules below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            <section
              aria-labelledby="module-presets-heading"
              className="mx-auto flex w-full max-w-5xl flex-col gap-5"
            >
              <ToggleGroup
                type="single"
                value={activePreset}
                onValueChange={(key) => {
                  const preset = presets.find((candidate) => candidate.key === key)
                  if (preset) applyPreset(preset)
                }}
                variant="outline"
                aria-label="Module presets"
                className="grid w-full grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                {presets.map((preset) => {
                  const active = preset.key === activePreset
                  const Icon = PRESET_ICONS[preset.key] ?? Boxes
                  const moduleCount = closureEnable(new Set(preset.modules)).size
                  return (
                    <ToggleGroupItem
                      key={preset.key}
                      value={preset.key}
                      aria-label={`Apply ${preset.label} preset`}
                      className="aspect-square h-auto w-full min-w-0 flex-col items-start justify-between whitespace-normal rounded-xl p-5 text-left data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:shadow-md"
                    >
                      <span className="flex w-full items-start justify-between gap-3">
                        <span
                          className={cn(
                            'flex size-11 items-center justify-center rounded-lg',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <Icon className="size-5" />
                        </span>
                        <Badge variant={active ? 'default' : 'outline'}>
                          {active ? 'Selected' : 'Preset'}
                        </Badge>
                      </span>

                      <span className="flex flex-col items-start gap-2">
                        <span className="text-lg font-semibold">{preset.label}</span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {preset.description}
                        </span>
                      </span>

                      <span className="text-xs font-normal text-muted-foreground">
                        {moduleCount} modules included
                      </span>
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </section>

            <Separator />

            <section aria-labelledby="module-workflow-heading" className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h3 id="module-workflow-heading" className="font-medium">
                  Workflow
                </h3>
                <p className="text-sm text-muted-foreground">
                  Click a stage or feature to toggle it. Dependencies are handled automatically.
                </p>
              </div>
              <ModulePipeline
                modules={modules}
                selected={selected}
                onToggle={toggle}
                blockedReason={blockedReason}
              />
            </section>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Update module configuration?"
        variant="default"
        confirmLabel={saving ? 'Saving…' : 'Save'}
        description={
          <span className="flex flex-col gap-2">
            {turningOff.length > 0 && (
              <span>
                <span className="font-medium text-foreground">Disabling:</span>{' '}
                {turningOff.map(labelOf).join(', ')}. These will be hidden and blocked; their data
                is kept.
              </span>
            )}
            {turningOn.length > 0 && (
              <span>
                <span className="font-medium text-foreground">Enabling:</span>{' '}
                {turningOn.map(labelOf).join(', ')}.
              </span>
            )}
          </span>
        }
        onConfirm={save}
      />
    </TooltipProvider>
  )
}

ModulesSettings.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
