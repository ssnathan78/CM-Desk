import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material"
import axios from "axios"
import dayjs from "dayjs"
import Link from "next/link"
import { useEffect, useState } from "react"
import Layout from "../components/Layout"
import { apiErrorMessage } from "../lib/apiClientError"
import { STRATEGIES_DETAILS } from "../lib/constants"
import fetchJson from "../lib/fetchJson"
import useUser from "../lib/useUser"

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]

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

export default function PlanPage() {
  useUser({ redirectTo: "/" })
  const [templates, setTemplates] = useState<Template[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [templateId, setTemplateId] = useState("")
  const [dayOfWeek, setDayOfWeek] = useState("MONDAY")
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const data = await fetchJson<{ templates: Template[]; schedules: Schedule[] }>("/api/templates")
    setTemplates(data.templates || [])
    setSchedules(data.schedules || [])
  }

  useEffect(() => {
    fetchJson<{ templates: Template[]; schedules: Schedule[] }>("/api/templates")
      .then(data => {
        setTemplates(data.templates || [])
        setSchedules(data.schedules || [])
      })
      .catch(e => setError(apiErrorMessage(e, "Could not load schedules")))
  }, [])

  return (
    <Layout>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Schedules
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        A schedule is a weekday clock on a template. Editing the template does not change a job that
        already fired.
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            select
            label="Template"
            value={templateId}
            onChange={e => setTemplateId(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
          >
            {templates.map(row => (
              <MenuItem key={row.id} value={row.id}>
                {row.name} · {row.instrument}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Weekday"
            value={dayOfWeek}
            onChange={e => setDayOfWeek(e.target.value)}
            size="small"
          >
            {DAYS.map(day => (
              <MenuItem key={day} value={day}>
                {day}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            disabled={!templateId}
            onClick={async () => {
              setError(null)
              try {
                const template = templates.find(row => row.id === templateId)
                await axios.post("/api/schedules", {
                  templateId,
                  dayOfWeek,
                  runAt: template?.runAt,
                  enabled: true,
                })
                await load()
              } catch (e) {
                setError(apiErrorMessage(e, "Could not save schedule"))
              }
            }}
          >
            Attach
          </Button>
        </Stack>
      </Paper>
      {DAYS.map(day => {
        const rows = schedules.filter(row => row.dayOfWeek === day)
        return (
          <Paper key={day} sx={{ p: 2, mb: 1 }}>
            <Typography variant="subtitle1">{day}</Typography>
            {rows.length === 0 ? (
              <Typography color="text.secondary">Nothing scheduled.</Typography>
            ) : (
              rows.map(row => {
                const template = templates.find(item => item.id === row.templateId)
                const heading = template?.strategy
                  ? STRATEGIES_DETAILS[template.strategy]?.heading
                  : ""
                return (
                  <Stack
                    key={row.id}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", mt: 1 }}
                  >
                    <Typography sx={{ flex: 1 }}>
                      {template?.name || row.templateId}
                      {heading ? ` · ${heading}` : ""}
                      {template?.instrument ? ` · ${template.instrument}` : ""}
                      {row.runAt ? ` · ${dayjs(row.runAt).format("HH:mm")}` : ""}
                      {row.enabled ? "" : " · paused"}
                    </Typography>
                    <Button component={Link} href={`/templates?id=${row.templateId}`} size="small">
                      Template
                    </Button>
                    <Button
                      size="small"
                      color="warning"
                      onClick={async () => {
                        await axios.delete("/api/schedules", { data: { id: row.id } })
                        await load()
                      }}
                    >
                      Remove
                    </Button>
                  </Stack>
                )
              })
            )}
          </Paper>
        )
      })}
    </Layout>
  )
}
