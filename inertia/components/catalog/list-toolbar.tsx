import { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type ToolbarSelect = {
  name: string
  value: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

type Props = {
  basePath: string
  q: string
  searchPlaceholder?: string
  selects?: ToolbarSelect[]
}

function buildParams(
  q: string,
  selects: ToolbarSelect[],
  override?: { name: string; value: string }
): Record<string, string> {
  const params: Record<string, string> = {}
  if (q.trim()) params.q = q.trim()
  for (const s of selects) {
    const value = override && override.name === s.name ? override.value : s.value
    if (value && value !== 'all') params[s.name] = value
  }
  return params
}

export function ListToolbar({ basePath, q, searchPlaceholder, selects = [] }: Props) {
  const [search, setSearch] = useState(q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    setSearch(q)
  }, [q])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      router.get(basePath, buildParams(search, selects), {
        preserveState: true,
        preserveScroll: true,
        replace: true,
      })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  function changeSelect(name: string, value: string) {
    router.get(basePath, buildParams(search, selects, { name, value }), {
      preserveState: true,
      preserveScroll: true,
      replace: true,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder ?? 'Search…'}
        className="w-full sm:w-72"
      />
      {selects.map((s) => (
        <Select
          key={s.name}
          value={s.value || 'all'}
          onValueChange={(v) => changeSelect(s.name, v)}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={s.placeholder ?? 'All'} />
          </SelectTrigger>
          <SelectContent>
            {s.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  )
}
