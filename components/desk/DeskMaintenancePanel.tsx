import { Button, Stack, Typography } from "@mui/material"
import { useState } from "react"
import fetchJson from "../../lib/fetchJson"
import { chaseResetConfirm } from "../../lib/operatorActionCopy"
import ConfirmAction from "../lib/ConfirmAction"
import PageSection from "../lib/PageSection"
import SimulationRunnerPanel from "./SimulationRunnerPanel"

export default function DeskMaintenancePanel({
  onPaperClear,
  onChaseResetDone,
}: {
  onPaperClear: () => void
  onChaseResetDone: () => void
}) {
  const [chaseOpen, setChaseOpen] = useState(false)
  const [bookNames, setBookNames] = useState<string[]>([])
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  return (
    <PageSection
      title="Maintenance"
      description="Ledger maintenance. None of these send a Kite order."
    >
      <Stack spacing={2} sx={{ alignItems: "stretch" }}>
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Button variant="outlined" color="inherit" onClick={onPaperClear}>
            Clear paper book…
          </Button>
          <Typography variant="caption" color="text.secondary">
            Removes the paper ledger after open paper positions and working paper orders are gone.
            The broker is not contacted.
          </Typography>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              setResetError(null)
              void fetchJson<{ books: { instrument: string }[] }>("/api/chase-settings")
                .then(data => {
                  setBookNames((data.books ?? []).map(book => book.instrument))
                  setChaseOpen(true)
                })
                .catch(e => {
                  setResetError(e instanceof Error ? e.message : "Could not load Chase books")
                })
            }}
          >
            Reset all Chase books to a fresh signal…
          </Button>
          <Typography variant="caption" color="text.secondary">
            Refuses the whole reset if any book still has quantity. Nothing is changed in that case.
          </Typography>
          {resetError && !chaseOpen ? (
            <Typography variant="caption" color="error">
              {resetError}
            </Typography>
          ) : null}
        </Stack>
        <SimulationRunnerPanel />
      </Stack>
      <ConfirmAction
        open={chaseOpen}
        tone="attention"
        title={chaseResetConfirm(bookNames).title}
        message={chaseResetConfirm(bookNames).message}
        confirmLabel="Reset signals"
        defaultFocus="cancel"
        busy={resetting}
        error={resetError}
        onCancel={() => {
          setChaseOpen(false)
          setResetError(null)
        }}
        onConfirm={async () => {
          setResetting(true)
          setResetError(null)
          try {
            await fetchJson("/api/chase-settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "reset-signal" }),
            })
            setChaseOpen(false)
            onChaseResetDone()
          } catch (e) {
            setResetError(e instanceof Error ? e.message : "Could not reset Chase")
          } finally {
            setResetting(false)
          }
        }}
      />
    </PageSection>
  )
}
