import {
  CHASE_INDEX_ORDER,
  CHASE_OPEN_CLASSIFY,
  type ChaseBookConfig,
  type ChaseOpenClassify,
} from "../chaseDefaults"

export type ChaseConfigField =
  | "emaPeriod"
  | "bufferPercent"
  | "marketProtectionPercent"
  | "entryLimitOffset"
  | "openClassify"
  | "lots"

const CONFIG_FIELDS: ChaseConfigField[] = [
  "emaPeriod",
  "bufferPercent",
  "marketProtectionPercent",
  "entryLimitOffset",
  "openClassify",
  "lots",
]

/** First enabled book in index order; else Nifty; else first row. Used to highlight per-book diffs. */
export function chaseConfigPrimaryBook(books: ChaseBookConfig[]): ChaseBookConfig | null {
  if (!books.length) return null
  const enabled = books.filter(b => b.enabled)
  const fromEnabled = CHASE_INDEX_ORDER.map(name => enabled.find(b => b.instrument === name)).find(
    Boolean
  )
  if (fromEnabled) return fromEnabled
  return books.find(b => b.instrument === "NIFTY") ?? books[0]
}

export function chaseConfigFieldDiffers(
  book: ChaseBookConfig,
  primary: ChaseBookConfig,
  field: ChaseConfigField
): boolean {
  if (book.instrument === primary.instrument) return false
  return book[field] !== primary[field]
}

export function chaseConfigDiffFields(
  book: ChaseBookConfig,
  primary: ChaseBookConfig | null
): Set<ChaseConfigField> {
  const out = new Set<ChaseConfigField>()
  if (!primary) return out
  for (const field of CONFIG_FIELDS) {
    if (chaseConfigFieldDiffers(book, primary, field)) out.add(field)
  }
  return out
}

export function chaseOpenClassifyShortLabel(value: ChaseOpenClassify): string {
  return value === CHASE_OPEN_CLASSIFY.LEGACY_60M ? "Legacy" : "PDF"
}
