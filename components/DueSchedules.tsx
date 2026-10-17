import { Alert, Button, Stack, Typography } from "@mui/material"
import dayjs from "dayjs"
import Link from "next/link"
import { useState } from "react"
import useSWR from "swr"
import { STRATEGIES_DETAILS } from "../lib/constants"
import fetchJson, { type FetchJsonError } from "../lib/fetchJson"
import { dueSchedulePresentation } from "../lib/operatorActionCopy"
import ConfirmAction from "./lib/ConfirmAction"
import PageSection from "./lib/PageSection"

type DueRow = {
  id: string
  templateId: string
  runAt?: string | null
  template?: { id?: string; name?: string; strategy?: string; instrument?: string }
}

export default function DueSchedules() {
  const { data, mutate } = useSWR<DueRow[]>("/api/schedules")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, setPending] = useState<DueRow | null>(null)
  if (!data?.length) return null

  const pendingName = pending?.template?.name || "Template"
  const pendingStrategy = pending?.template?.strategy
  const pendingLabel = pendingStrategy
    ? STRATEGIES_DETAILS[pendingStrategy]?.heading || pendingStrategy
    : ""
  const pendingDetail = [pendingLabel, pending?.template?.instrument].filter(Boolean).join(" · ")
  const presentation = pending
    ? dueSchedulePresentation({
        now: new Date(),
        runAt: pending.runAt,
        name: pendingName,
        detail: pendingDetail,
      })
    : null

  return (
    <PageSection
      title="Due today"
      description="These schedules are not queued yet. Schedule copies the template into a job."
    >
      {error ? (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <ConfirmAction
        open={Boolean(pending && presentation)}
        tone="attention"
        title={presentation?.title ?? "Schedule?"}
        message={presentation?.message}
        confirmLabel={presentation?.runsNow ? "Run now" : "Queue"}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending || !presentation) return
          const row = pending
          const runsNow = presentation.runsNow
          setPending(null)
          setBusy(row.id)
          setError(null)
          try {
            await fetchJson("/api/schedules", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "today",
                templateId: row.templateId,
                runAt: row.runAt,
                runNow: runsNow,
              }),
            })
            await mutate()
          } catch (e) {
            const err = e as FetchJsonError
            setError(err.message || "Could not schedule")
          } finally {
            setBusy(null)
          }
        }}
      />
      <Stack spacing={1}>
        {data.map(row => {
          const name = row.template?.name || "Template"
          const strategy = row.template?.strategy
          const label = strategy ? STRATEGIES_DETAILS[strategy]?.heading || strategy : ""
          return (
            <Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography sx={{ flex: 1 }}>
                {name}
                {label ? ` · ${label}` : ""}
                {row.template?.instrument ? ` · ${row.template.instrument}` : ""}
                {row.runAt ? ` · ${dayjs(row.runAt).format("HH:mm")}` : ""}
              </Typography>
              <Button component={Link} href={`/templates?id=${row.templateId}`} size="small">
                Template
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={busy === row.id}
                onClick={() => setPending(row)}
              >
                {
                  dueSchedulePresentation({
                    now: new Date(),
                    runAt: row.runAt,
                    name,
                    detail: [label, row.template?.instrument].filter(Boolean).join(" · "),
                  }).buttonLabel
                }
              </Button>
            </Stack>
          )
        })}
      </Stack>
    </PageSection>
  )
}
