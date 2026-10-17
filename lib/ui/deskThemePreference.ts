import { type DeskThemeId, parseDeskThemeId } from "../../src/deskThemes"

export const DESK_THEME_STORAGE_KEY = "desk.theme"

export function readDeskTheme(): DeskThemeId {
  if (typeof window === "undefined") return "desk"
  try {
    return parseDeskThemeId(window.localStorage.getItem(DESK_THEME_STORAGE_KEY))
  } catch {
    return "desk"
  }
}

export function writeDeskTheme(id: DeskThemeId) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DESK_THEME_STORAGE_KEY, id)
}
