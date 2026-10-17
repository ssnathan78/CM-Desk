import { Button, Stack, Typography } from "@mui/material"
import { useState } from "react"
import fetchJson from "../../lib/fetchJson"
import ConfirmAction from "../lib/ConfirmAction"
import PageSection from "../lib/PageSection"
import SimulationRunnerPanel from "./SimulationRunnerPanel"

const CHASE_RESET_COPY =
  "Reset Nifty, BankNifty, FinNifty, and Midcap Nifty Chase status to AWAITING_SIGNAL? A book that still has futures quantity is refused and that position stays. Flat books, and pending entries that never filled, return to a fresh signal. This does not send a flatten. Use Square off on Chase or Desk → Positions to get out of a current book."

export default function DeskMaintenancePanel({
  onPaperClear,
  onChaseResetDone,
}: {
  onPaperClear: () => void
  onChaseResetDone: () => void
}) {
  const [chaseOpen, setChaseOpen] = useState(false)
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
            Zeros mock/paper ledger rows when Kite is flat.
          </Typography>
          <Button variant="outlined" color="inherit" onClick={() => setChaseOpen(true)}>
            Reset all Chase books to a fresh signal…
          </Button>
          <Typography variant="caption" color="text.secondary">
            Returns flat Chase books to AWAITING_SIGNAL; refuses books with open qty.
          </Typography>
        </Stack>
        <SimulationRunnerPanel />
      </Stack>
      <ConfirmAction
        open={chaseOpen}
        tone="attention"
        title="Reset Chase signals?"
        message={CHASE_RESET_COPY}
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
