import { Alert, Button, MenuItem, Stack, TextField, Typography } from "@mui/material"
import axios from "axios"
import { useEffect, useState } from "react"
import Layout from "../components/Layout"
import PageSection from "../components/lib/PageSection"
import ScheduleWeekGrid from "../components/schedules/ScheduleWeekGrid"
import { apiErrorMessage } from "../lib/apiClientError"
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
    <Layout title="Schedules">
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        A schedule is a weekday clock on a template. Editing the template does not change a job that
        already fired.
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <Stack spacing={3}>
        <PageSection
          title="Attach schedule"
          description="Pick a template and weekday; run time comes from the template."
        >
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
                  {day.charAt(0) + day.slice(1, 3).toLowerCase()}
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
        </PageSection>
        <PageSection title="Week grid" description="One card per weekday. Today is highlighted.">
          <ScheduleWeekGrid
            templates={templates}
            schedules={schedules}
            onAttachDay={day => setDayOfWeek(day)}
            onRemove={async schedule => {
              await axios.delete("/api/schedules", { data: { id: schedule.id } })
              await load()
            }}
          />
        </PageSection>
      </Stack>
    </Layout>
  )
}
