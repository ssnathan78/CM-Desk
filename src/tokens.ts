import { DESK_THEMES, type DeskColors, type DeskThemeId } from "./deskThemes"

let activeId: DeskThemeId = "desk"

/** Swap the palette read by `color`. Call this before the React render that should show it. */
export function setActiveDeskTheme(id: DeskThemeId) {
  activeId = id
}

export function getActiveDeskTheme(): DeskThemeId {
  return activeId
}

/** Live palette. Components that read `color` on each render pick up the active theme. */
export const color: DeskColors = new Proxy({} as DeskColors, {
  get(_target, prop: string) {
    return DESK_THEMES[activeId][prop as keyof DeskColors]
  },
})
