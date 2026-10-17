import { Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material"
import { useEffect, useState } from "react"
import useSWR from "swr"
import fetchJson from "../../lib/fetchJson"
import PageSection from "../lib/PageSection"

export default function SimulationRunnerPanel() {
  const { data: catalog } = useSWR<{ scenarios?: string[] }>("/api/desk/simulate", {
    revalidateOnFocus: false,
  })
  const scenarios = catalog?.scenarios ?? []
  const [scenario, setScenario] = useState("")
  const [report, setReport] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!scenario && scenarios.length) setScenario(scenarios[0])
  }, [scenario, scenarios])

  return (
    <PageSection
      title="Simulation (catalog)"
      description="Hermetic scenario runner — no Kite. Production requires ALLOW_SIM_UI=true."
    >
      <Stack spacing={1.5} sx={{ maxWidth: 480 }}>
        <TextField
          select
          size="small"
          label="Scenario"
          value={scenario}
          onChange={e => setScenario(e.target.value)}
          disabled={!scenarios.length}
        >
          {scenarios.map(id => (
            <MenuItem key={id} value={id}>
              {id}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          disabled={busy || !scenario}
          onClick={async () => {
            setBusy(true)
            setError(null)
            setReport(null)
            try {
              const result = await fetchJson<{ report?: string }>("/api/desk/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scenario }),
              })
              setReport(result.report || "Done")
            } catch (e) {
              setError(e instanceof Error ? e.message : "Simulation failed")
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? "Running…" : "Run scenario"}
        </Button>
        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : null}
        {report ? (
          <Paper
            variant="outlined"
            sx={{ p: 1.5, fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "pre-wrap" }}
          >
            {report}
          </Paper>
        ) : null}
      </Stack>
    </PageSection>
  )
}
