import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined"
import { Box, Button, Menu, MenuItem, Stack, Typography } from "@mui/material"
import { useState } from "react"

import { DESK_THEME_IDS, DESK_THEMES, type DeskThemeId } from "../../src/deskThemes"
import { useDeskTheme } from "./DeskThemeProvider"

function Swatch({ colors }: { colors: [string, string, string] }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5 }} aria-hidden>
      {colors.map(fill => (
        <Box
          key={fill}
          sx={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: fill,
            border: "1px solid",
            borderColor: "divider",
          }}
        />
      ))}
    </Box>
  )
}

export function DeskThemeMenu() {
  const { themeId, setThemeId } = useDeskTheme()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const current = DESK_THEMES[themeId]

  return (
    <>
      <Button
        size="small"
        color="inherit"
        startIcon={<PaletteOutlinedIcon fontSize="small" />}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-label={`Theme, ${current.label}`}
        onClick={event => setAnchor(event.currentTarget)}
        sx={{ flexShrink: 0, color: "text.secondary" }}
      >
        {current.label}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {DESK_THEME_IDS.map(id => (
          <MenuItem
            key={id}
            selected={id === themeId}
            onClick={() => {
              setThemeId(id)
              setAnchor(null)
            }}
          >
            <ThemeChoice id={id} />
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export function DeskThemeChoices() {
  const { themeId, setThemeId } = useDeskTheme()
  return (
    <Stack spacing={1}>
      {DESK_THEME_IDS.map(id => {
        const selected = id === themeId
        return (
          <Button
            key={id}
            onClick={() => setThemeId(id)}
            aria-pressed={selected}
            variant={selected ? "outlined" : "text"}
            color="inherit"
            sx={{
              justifyContent: "flex-start",
              textAlign: "left",
              px: 1.5,
              py: 1,
              borderColor: selected ? "primary.main" : "transparent",
            }}
          >
            <ThemeChoice id={id} />
          </Button>
        )
      })}
    </Stack>
  )
}

function ThemeChoice({ id }: { id: DeskThemeId }) {
  const theme = DESK_THEMES[id]
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", width: "100%" }}>
      <Swatch colors={theme.swatch} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{theme.label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {theme.description}
        </Typography>
      </Box>
    </Stack>
  )
}
