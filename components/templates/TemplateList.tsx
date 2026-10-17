import { Box, List, ListItemButton, ListItemText, Typography } from "@mui/material"
import { useEffect, useRef } from "react"

import { labelFor } from "../../lib/ui/labels"
export type TemplateRow = {
  id: string
  name?: string
  strategy?: string
  instrument?: string
  runAt?: string
  lots?: number | string
  schedules?: { dayOfWeek: string }[]
}

const DAY_CHIP = ["M", "T", "W", "T", "F"]
const DAY_KEYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]

function weekdayChips(schedules?: { dayOfWeek: string }[]) {
  const set = new Set((schedules ?? []).map(s => s.dayOfWeek))
  return DAY_KEYS.map((key, i) => (
    <Typography
      key={key}
      component="span"
      variant="caption"
      sx={{
        display: "inline-block",
        width: 18,
        textAlign: "center",
        fontWeight: set.has(key) ? 700 : 400,
        color: set.has(key) ? "primary.main" : "text.disabled",
      }}
    >
      {DAY_CHIP[i]}
    </Typography>
  ))
}

export default function TemplateList({
  rows,
  selectedId,
  onSelect,
}: {
  rows: TemplateRow[]
  selectedId: string | null
  onSelect: (row: TemplateRow) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!rows.length || !selectedId) return
      const idx = rows.findIndex(r => r.id === selectedId)
      if (e.key === "ArrowDown" && idx < rows.length - 1) {
        e.preventDefault()
        onSelect(rows[idx + 1])
      }
      if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault()
        onSelect(rows[idx - 1])
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [rows, selectedId, onSelect])

  return (
    <Box
      sx={{
        width: { xs: "100%", md: 300 },
        flexShrink: 0,
        borderRight: { md: 1 },
        borderColor: "divider",
        pr: { md: 1 },
      }}
    >
      <List dense ref={listRef} aria-label="Templates">
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            No templates yet.
          </Typography>
        ) : (
          rows.map(row => (
            <ListItemButton
              key={row.id}
              selected={row.id === selectedId}
              onClick={() => onSelect(row)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                borderLeft: 3,
                borderColor: row.id === selectedId ? "primary.main" : "transparent",
                bgcolor: row.id === selectedId ? "action.selected" : undefined,
              }}
            >
              <ListItemText
                primary={row.name || "Untitled"}
                secondary={
                  <>
                    {labelFor(row.strategy)} · {labelFor(row.instrument)}
                    <br />
                    {row.runAt ? String(row.runAt).slice(11, 16) : "—"} ·{" "}
                    {weekdayChips(row.schedules)}
                  </>
                }
              />
            </ListItemButton>
          ))
        )}
      </List>
    </Box>
  )
}
