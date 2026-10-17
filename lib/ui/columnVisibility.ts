export type ColumnDef<T extends string> = {
  id: T
  label: string
  defaultVisible?: boolean
  /** Cannot be hidden (not listed in menu). */
  locked?: boolean
}

export function defaultVisibleIds<T extends string>(columns: ColumnDef<T>[]): T[] {
  return columns.filter(col => col.defaultVisible !== false).map(col => col.id)
}

export function readVisibleColumns<T extends string>(
  storageKey: string,
  columns: ColumnDef<T>[],
  fallback: T[] = defaultVisibleIds(columns)
): T[] {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return fallback
    const allowed = new Set(columns.filter(c => !c.locked).map(c => c.id))
    const locked = columns.filter(c => c.locked).map(c => c.id)
    const chosen = parsed.filter((id): id is T => allowed.has(id as T))
    const merged = [...locked, ...chosen.filter(id => !locked.includes(id))]
    return merged.length ? merged : fallback
  } catch {
    return fallback
  }
}

export function writeVisibleColumns<T extends string>(storageKey: string, visible: T[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey, JSON.stringify(visible))
}

export function toggleVisibleColumn<T extends string>(
  visible: T[],
  columnId: T,
  columns: ColumnDef<T>[]
): T[] {
  const locked = new Set(columns.filter(c => c.locked).map(c => c.id))
  if (locked.has(columnId)) return visible
  if (visible.includes(columnId)) {
    const next = visible.filter(id => id !== columnId)
    const optional = columns.filter(c => !c.locked).map(c => c.id)
    if (!optional.some(id => next.includes(id))) return visible
    return next
  }
  return [...visible, columnId]
}

export function isColumnVisible<T extends string>(visible: T[], id: T): boolean {
  return visible.includes(id)
}

/** Optional columns for the menu: visible order first, then hidden. */
export function optionalColumnsForMenu<T extends string>(
  columns: ColumnDef<T>[],
  visible: T[]
): ColumnDef<T>[] {
  const optional = columns.filter(col => !col.locked)
  const visibleSet = new Set(visible)
  const shown = visible
    .map(id => optional.find(col => col.id === id))
    .filter((col): col is ColumnDef<T> => Boolean(col))
  const hidden = optional.filter(col => !visibleSet.has(col.id))
  return [...shown, ...hidden]
}

export function reorderVisibleColumn<T extends string>(
  visible: T[],
  columnId: T,
  direction: -1 | 1,
  columns: ColumnDef<T>[]
): T[] {
  const locked = new Set(columns.filter(c => c.locked).map(c => c.id))
  const idx = visible.indexOf(columnId)
  if (idx < 0 || locked.has(columnId)) return visible
  const swapWith = idx + direction
  if (swapWith < 0 || swapWith >= visible.length) return visible
  if (locked.has(visible[swapWith])) return visible
  const next = [...visible]
  ;[next[idx], next[swapWith]] = [next[swapWith], next[idx]]
  return next
}
