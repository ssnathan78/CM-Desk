import { DESK_THEME_IDS, DESK_THEMES, parseDeskThemeId } from "../../src/deskThemes"
import { createDeskTheme } from "../../src/theme"

function channel(hex: string, shift: number) {
  const value = parseInt(hex.slice(1), 16)
  const byte = (value >> shift) & 255
  const c = byte / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function contrast(a: string, b: string) {
  const lum = (hex: string) =>
    0.2126 * channel(hex, 16) + 0.7152 * channel(hex, 8) + 0.0722 * channel(hex, 0)
  const hi = Math.max(lum(a), lum(b))
  const lo = Math.min(lum(a), lum(b))
  return (hi + 0.05) / (lo + 0.05)
}

describe("parseDeskThemeId", () => {
  it("keeps a known theme", () => {
    expect(parseDeskThemeId("ledger")).toBe("ledger")
    expect(parseDeskThemeId("harbour")).toBe("harbour")
  })

  it("falls back to Desk when the stored value is missing or unknown", () => {
    expect(parseDeskThemeId(null)).toBe("desk")
    expect(parseDeskThemeId("")).toBe("desk")
    expect(parseDeskThemeId("neon")).toBe("desk")
    expect(parseDeskThemeId("reading-room")).toBe("desk")
    expect(parseDeskThemeId("garden-stone")).toBe("desk")
    expect(parseDeskThemeId("contract")).toBe("desk")
    expect(parseDeskThemeId("field")).toBe("desk")
  })
})

describe("desk themes", () => {
  it("offers the six kept palettes", () => {
    expect(DESK_THEME_IDS).toEqual([
      "desk",
      "harbour",
      "blueprint",
      "night-watch",
      "study-lamp",
      "ledger",
    ])
  })

  it("keeps night themes dark and the paper themes light", () => {
    expect(DESK_THEMES.desk.mode).toBe("dark")
    expect(DESK_THEMES.harbour.mode).toBe("dark")
    expect(DESK_THEMES["night-watch"].mode).toBe("dark")
    expect(DESK_THEMES["study-lamp"].mode).toBe("dark")
    expect(DESK_THEMES.blueprint.mode).toBe("light")
    expect(DESK_THEMES.ledger.mode).toBe("light")
  })

  it("builds a Material theme for every palette", () => {
    for (const id of DESK_THEME_IDS) {
      const theme = createDeskTheme(id)
      expect(theme.palette.mode).toBe(DESK_THEMES[id].mode)
      expect(theme.palette.background.default).toBe(DESK_THEMES[id].bg.canvas)
      expect(theme.palette.success.main).toBe(DESK_THEMES[id].profit)
    }
  })

  it("keeps ink readable on Harbour, Blueprint, and Night watch", () => {
    const ids = ["harbour", "blueprint", "night-watch"] as const
    const accents = new Set(ids.map(id => DESK_THEMES[id].accent.main))
    expect(accents.size).toBe(ids.length)
    for (const id of ids) {
      const theme = DESK_THEMES[id]
      expect(contrast(theme.text.primary, theme.bg.canvas)).toBeGreaterThanOrEqual(7)
      expect(contrast(theme.text.secondary, theme.bg.surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme.accent.main, theme.bg.surface)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("does not reuse the Desk alarm red on the quieter palettes", () => {
    const alarm = DESK_THEMES.desk.danger.main
    for (const id of DESK_THEME_IDS) {
      if (id === "desk") continue
      expect(DESK_THEMES[id].danger.main).not.toBe(alarm)
      expect(DESK_THEMES[id].bg.canvas).not.toBe(DESK_THEMES.desk.bg.canvas)
    }
  })
})
