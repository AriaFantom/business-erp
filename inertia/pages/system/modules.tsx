import { useMemo, useState, type ReactElement } from 'react'
import { router, usePage } from '@inertiajs/react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/confirm-dialog'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ModulePipeline, type ModuleDef } from '@/components/modules/module-pipeline'
import type { InertiaProps } from '@/types'

type Preset = { key: string; label: string; description: string; modules: string[] }

type PageProps = InertiaProps<{
  modules: ModuleDef[]
  presets: Preset[]
  enabled: string[]
}>

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

  function reset() {
    setSelected(new Set(enabled))
  }

  function blockedReason(key: string): string | null {
    if (selected.has(key)) return null
    const missing = (byKey.get(key)?.dependsOn ?? []).filter((d) => !selected.has(d))
    return missing.length > 0 ? `Enable ${missing.map(labelOf).join(', ')} first` : null
  }

  const enabledSet = useMemo(() => new Set(enabled), [enabled])
  const dirty =
    selected.size !== enabledSet.size || [...selected].some((k) => !enabledSet.has(k))

  const turningOff = enabled.filter((k) => !selected.has(k))
  const turningOn = [...selected].filter((k) => !enabledSet.has(k))

  function save() {
    setSaving(true)
    router.post(
      '/system/modules',
      { enabledModules: Array.from(selected) },
      {
        preserveScroll: true,
        onFinish: () => {
          setSaving(false)
          setConfirmOpen(false)
        },
      }
    )
  }

  return (
    <TooltipProvider>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
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

        <Card>
          <CardHeader>
            <CardTitle>Presets</CardTitle>
            <CardDescription>Start from a common workflow, then fine-tune below.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {presets.map((preset) => (
              <Button
                key={preset.key}
                variant="outline"
                className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
                onClick={() => applyPreset(preset)}
              >
                <span className="font-medium">{preset.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {preset.description}
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
            <CardDescription>
              Click a stage or feature to toggle it. Dependencies are handled automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ModulePipeline
              modules={modules}
              selected={selected}
              onToggle={toggle}
              blockedReason={blockedReason}
            />
          </CardContent>
        </Card>

        <div className="sticky bottom-4 flex items-center justify-end gap-2">
          {dirty && (
            <Button variant="ghost" onClick={reset} disabled={saving}>
              <RotateCcw />
              Reset
            </Button>
          )}
          <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || saving}>
            Save changes
          </Button>
        </div>
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
