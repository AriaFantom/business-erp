/* eslint-disable @unicorn/filename-case */

export type DocumentBranding = {
  name: string
  iconUrl: string | null
}

const FAVICON_ATTRIBUTE = 'data-dashboard-favicon'

let activeDashboardName = 'LayerDreams'

export function setInitialDashboardName(name: string): void {
  activeDashboardName = name.trim() || activeDashboardName
}

export function formatDocumentTitle(pageTitle: string): string {
  return pageTitle ? `${pageTitle} - ${activeDashboardName}` : activeDashboardName
}

export function replaceDashboardNameInTitle(
  currentTitle: string,
  previousName: string,
  nextName: string
): string {
  if (!currentTitle || currentTitle === previousName) return nextName

  const previousSuffix = ` - ${previousName}`
  if (!currentTitle.endsWith(previousSuffix)) return currentTitle

  return `${currentTitle.slice(0, -previousSuffix.length)} - ${nextName}`
}

function syncFavicon(iconUrl: string | null): void {
  const existing = document.head.querySelector<HTMLLinkElement>(`link[${FAVICON_ATTRIBUTE}]`)

  if (!iconUrl) {
    existing?.remove()
    return
  }

  const favicon = existing ?? document.createElement('link')
  favicon.rel = 'icon'
  favicon.href = iconUrl
  favicon.setAttribute(FAVICON_ATTRIBUTE, '')
  if (!existing) document.head.appendChild(favicon)
}

export function initializeDocumentBranding(
  branding: DocumentBranding | undefined,
  authenticated: boolean
): void {
  const nextName = branding?.name.trim() || activeDashboardName
  activeDashboardName = nextName
  document.title = nextName
  syncFavicon(authenticated ? (branding?.iconUrl ?? null) : null)
}

export function syncDocumentBranding(
  branding: DocumentBranding | undefined,
  authenticated: boolean
): void {
  const previousName = activeDashboardName
  const nextName = branding?.name.trim() || previousName

  activeDashboardName = nextName
  document.title = replaceDashboardNameInTitle(document.title, previousName, nextName)
  syncFavicon(authenticated ? (branding?.iconUrl ?? null) : null)
}
