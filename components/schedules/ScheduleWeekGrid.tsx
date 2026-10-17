import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import { Box, Button, IconButton, Menu, MenuItem, Paper, Stack, Typography } from "@mui/material"
import dayjs from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import Link from "next/link"
import { useMemo, useState } from "react"
import { STRATEGIES_DETAILS } from "../../lib/constants"
import { IST_TZ } from "../../lib/marketCalendar"
import { labelFor } from "../../lib/ui/labels"
import ConfirmAction from "../lib/ConfirmAction"

dayjs.extend(utc)
dayjs.extend(timezone)

const DAYS = [
  { key: "MONDAY", label: "Mon" },
  { key: "TUESDAY", label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY", label: "Thu" },
  { key: "FRIDAY", label: "Fri" },
] as const

type Template = {
  id: string
  name?: string
  strategy?: string
  instrument?: string
  runAt?: string
}
type Schedule = {
  id: string
  templateId: string
  dayOfWeek: string
  runAt?: string | null
  enabled: boolean
}

function runTimeLabel(runAt?: string | null) {
  if (!runAt) return "—"
  return dayjs(runAt).tz(IST_TZ).format("HH:mm")
}

function outsideMarket(runAt?: string | null) {
  if (!runAt) return false
  const m = dayjs(runAt).tz(IST_TZ)
  const minutes = m.hour() * 60 + m.minute()
  return minutes < 9 * 60 + 15 || minutes > 15 * 60 + 30
}

export default function ScheduleWeekGrid({
  templates,
  schedules,
  onRemove,
  onAttachDay,
}: {
  templates: Template[]
  schedules: Schedule[]
  onRemove: (schedule: Schedule, templateName: string, dayLabel: string) => Promise<void>
  onAttachDay: (dayKey: string) => void
}) {
  const todayKey = useMemo(() => {
    const d = dayjs().tz(IST_TZ).format("dddd").toUpperCase()
    return DAYS.find(x => x.key === d)?.key ?? null
  }, [])
  const [menu, setMenu] = useState<{ schedule: Schedule; anchor: HTMLElement } | null>(null)
  const [removeOpen, setRemoveOpen] = useState<{
    schedule: Schedule
    templateName: string
    dayLabel: string
  } | null>(null)

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(5, 1fr)" },
        gap: 1,
      }}
    >
      {DAYS.map(day => {
        const rows = schedules.filter(s => s.dayOfWeek === day.key)
        const isToday = day.key === todayKey
        return (
          <Paper
            key={day.key}
            variant="outlined"
            sx={{
              p: 1.5,
              minHeight: 160,
              borderTopWidth: isToday ? 3 : 1,
              borderTopColor: isToday ? "primary.main" : "divider",
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {day.label}
            </Typography>
            {rows.length === 0 ? (
              <Button size="small" onClick={() => onAttachDay(day.key)}>
                +
              </Button>
            ) : (
              rows.map(row => {
                const template = templates.find(t => t.id === row.templateId)
                const heading = template?.strategy
                  ? STRATEGIES_DETAILS[template.strategy]?.heading
                  : ""
                const name = template?.name || row.templateId
                return (
                  <Box key={row.id} sx={{ mb: 1, p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "flex-start" }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {runTimeLabel(row.runAt ?? template?.runAt)}
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }} noWrap>
                          {name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                          noWrap
                        >
                          {heading || labelFor(template?.strategy)}
                          {template?.instrument ? ` · ${labelFor(template.instrument)}` : ""}
                        </Typography>
                        {!row.enabled ? (
                          <Typography variant="caption" color="warning.main">
                            Paused
                          </Typography>
                        ) : null}
                        {outsideMarket(row.runAt ?? template?.runAt) ? (
                          <Typography variant="caption" color="warning.main">
                            Outside market hours
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        size="small"
                        aria-label="Schedule actions"
                        onClick={e => setMenu({ schedule: row, anchor: e.currentTarget })}
                      >
                        <MoreHorizIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                )
              })
            )}
          </Paper>
        )
      })}
      <Menu anchorEl={menu?.anchor ?? null} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu ? (
          <>
            <MenuItem
              component={Link}
              href={`/templates?id=${menu.schedule.templateId}`}
              onClick={() => setMenu(null)}
            >
              Open template
            </MenuItem>
            <MenuItem
              onClick={() => {
                const template = templates.find(t => t.id === menu.schedule.templateId)
                const dayLabel =
                  DAYS.find(d => d.key === menu.schedule.dayOfWeek)?.label ??
                  menu.schedule.dayOfWeek
                setRemoveOpen({
                  schedule: menu.schedule,
                  templateName: template?.name || "template",
                  dayLabel,
                })
                setMenu(null)
              }}
            >
              Remove from day…
            </MenuItem>
          </>
        ) : null}
      </Menu>
      <ConfirmAction
        open={Boolean(removeOpen)}
        title={`Remove from ${removeOpen?.dayLabel}?`}
        message={`Remove ${removeOpen?.templateName} from ${removeOpen?.dayLabel}? The template stays.`}
        confirmLabel="Remove"
        onCancel={() => setRemoveOpen(null)}
        onConfirm={async () => {
          if (!removeOpen) return
          await onRemove(removeOpen.schedule, removeOpen.templateName, removeOpen.dayLabel)
          setRemoveOpen(null)
        }}
      />
    </Box>
  )
}
