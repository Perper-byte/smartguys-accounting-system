// src/shared/formatters.ts

/**
 * Cleans internal metadata tags like [META:...] and [ITEMS:...] from description strings.
 * If cleaning leaves the description empty, it extracts human-readable item descriptions
 * from the payload so the display is never a blank line.
 */
export function cleanDescription(rawDesc?: string | null): string {
  if (!rawDesc) return ''
  const text = String(rawDesc).trim()
  if (!text) return ''

  // 1. Try extracting item names in case the string only contains metadata tags
  const extractedItems: string[] = []
  const itemsMatches = text.matchAll(/\[ITEMS:([\s\S]*?)\]/g)
  for (const match of itemsMatches) {
    const rawJson = match[1]
    let parsed: any = null
    try {
      parsed = JSON.parse(decodeURIComponent(rawJson))
    } catch {
      try {
        parsed = JSON.parse(rawJson)
      } catch {
        // Ignore JSON parse errors
      }
    }
    if (Array.isArray(parsed)) {
      for (const it of parsed) {
        const name = (it.description || it.name || '').trim()
        if (name) extractedItems.push(name)
      }
    }
  }

  // 2. Strip all [META:...] and [ITEMS:...] tags (case-insensitive, global)
  const cleaned = text
    .replace(/\[META:[^\]]*\]\s*/gi, '')
    .replace(/\[ITEMS:[\s\S]*?\]\s*/gi, '')
    .trim()

  // 3. If cleaning left the description blank, fallback to extracted items
  if (!cleaned && extractedItems.length > 0) {
    return extractedItems.join(', ')
  }

  return cleaned
}
