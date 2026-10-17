export type ShortcutHelp = { keys: string; description: string }

export type ShortcutAction = "help" | "desk" | "risk"

export const DESK_SHORTCUTS: ShortcutHelp[] = [
  { keys: "?", description: "Open keyboard shortcuts" },
  { keys: "g then d", description: "Go to Desk" },
  { keys: "g then r", description: "Go to Risk" },
]

export function shortcutTargetIsEditable(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  return Boolean(target?.closest("input, textarea, select, [contenteditable=true]"))
}

export function reduceShortcutState(
  pendingG: boolean,
  event: KeyboardEvent
): { pendingG: boolean; action: ShortcutAction | null } {
  if (shortcutTargetIsEditable(event)) return { pendingG: false, action: null }
  if (event.metaKey || event.ctrlKey || event.altKey) return { pendingG: false, action: null }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

  if (key === "?" || (key === "/" && event.shiftKey)) {
    return { pendingG: false, action: "help" }
  }

  if (pendingG) {
    if (key === "d") return { pendingG: false, action: "desk" }
    if (key === "r") return { pendingG: false, action: "risk" }
    return { pendingG: false, action: null }
  }

  if (key === "g") return { pendingG: true, action: null }
  return { pendingG: false, action: null }
}

/** @deprecated Use reduceShortcutState in the keyboard shortcuts dialog. */
export function matchShortcut(_event: KeyboardEvent, _sequence: string[]): boolean {
  return true
}
