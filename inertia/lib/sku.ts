/**
 * Client-side SKU suggestion.
 *
 * Produces a readable, collision-resistant code from an item name, e.g.
 * "Cotton Yarn Blue" → "COT-YAR-BLU-K3F9". The shape stays within the server's
 * SKU rule (`skuRule` in app/validators/catalog.ts): starts alphanumeric, then
 * only A–Z, 0–9, dot, underscore or hyphen. The server still owns uniqueness —
 * this only saves the user from inventing one.
 */

const MAX_WORDS = 4
const CHARS_PER_WORD = 3
const SUFFIX_LENGTH = 4

function randomSuffix(): string {
  // Base36 keeps the suffix alphanumeric and short; uppercased to match the
  // rest of the SKU.
  let out = ''
  while (out.length < SUFFIX_LENGTH) {
    out += Math.random().toString(36).slice(2).toUpperCase()
  }
  return out.slice(0, SUFFIX_LENGTH)
}

export function generateSku(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
    .map((word) => word.slice(0, CHARS_PER_WORD))

  const stem = words.join('-')
  // An empty or non-alphanumeric name still has to yield a valid SKU.
  if (!stem) return `SKU-${randomSuffix()}`
  return `${stem}-${randomSuffix()}`
}
