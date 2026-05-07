import * as React from 'react'

const STORAGE_PREFIX = 'table:'

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}:columns`
}

function readHidden(scope: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(storageKey(scope))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed.map(String))
    return new Set()
  } catch {
    return new Set()
  }
}

function writeHidden(scope: string, hidden: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify([...hidden]))
  } catch {
    // ignore — quota or privacy mode
  }
}

export type UseColumnVisibility = {
  isVisible: (key: string) => boolean
  toggle: (key: string) => void
  reset: () => void
  hidden: Set<string>
}

/**
 * Per-page column-visibility state, persisted to localStorage so user
 * preferences survive reloads. Stores the *hidden* set so newly added
 * columns default to visible without code changes.
 */
export function useColumnVisibility(scope: string): UseColumnVisibility {
  const [hidden, setHidden] = React.useState<Set<string>>(() => readHidden(scope))

  const isVisible = React.useCallback((key: string) => !hidden.has(key), [hidden])

  const toggle = React.useCallback(
    (key: string) => {
      setHidden((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        writeHidden(scope, next)
        return next
      })
    },
    [scope]
  )

  const reset = React.useCallback(() => {
    const empty = new Set<string>()
    writeHidden(scope, empty)
    setHidden(empty)
  }, [scope])

  return { isVisible, toggle, reset, hidden }
}
