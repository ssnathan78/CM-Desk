import { ThemeProvider } from "@mui/material/styles"
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"

import { readDeskTheme, writeDeskTheme } from "../../lib/ui/deskThemePreference"
import type { DeskThemeId } from "../../src/deskThemes"
import { createDeskTheme } from "../../src/theme"
import { setActiveDeskTheme } from "../../src/tokens"

type DeskThemeContextValue = {
  themeId: DeskThemeId
  setThemeId: (id: DeskThemeId) => void
}

const DeskThemeContext = createContext<DeskThemeContextValue | null>(null)

export function useDeskTheme(): DeskThemeContextValue {
  const value = useContext(DeskThemeContext)
  if (!value) throw new Error("Theme controls must sit inside DeskThemeProvider")
  return value
}

export default function DeskThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<DeskThemeId>("desk")

  useEffect(() => {
    const stored = readDeskTheme()
    setActiveDeskTheme(stored)
    setThemeIdState(stored)
  }, [])

  const muiTheme = useMemo(() => createDeskTheme(themeId), [themeId])

  const setThemeId = (id: DeskThemeId) => {
    writeDeskTheme(id)
    setActiveDeskTheme(id)
    setThemeIdState(id)
  }

  return (
    <DeskThemeContext.Provider value={{ themeId, setThemeId }}>
      <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>
    </DeskThemeContext.Provider>
  )
}
