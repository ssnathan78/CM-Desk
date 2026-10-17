import BlockIcon from "@mui/icons-material/Block"
import {
  Button,
  Popover,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material"
import { useState } from "react"

import fetchJson from "../../lib/fetchJson"
import ConfirmDialog from "../lib/ConfirmDialog"

type Props = {
  deskHalted: boolean
  haltReason: string | null
  busy?: boolean
  onChanged: () => void | Promise<void>
  compact?: boolean
}

export default function HaltControl({
  deskHalted,
  haltReason,
  busy,
  onChanged,
  compact,
}: Props) {
  const [reasonAnchor, setReasonAnchor] = useState<HTMLElement | null>(null)
  const [reasonDraft, setReasonDraft] = useState("")
  const [resumeOpen, setResumeOpen] = useState(false)
  const [localBusy, setLocalBusy] = useState(false)

  const runHalt = async (reason: string) => {
    setLocalBusy(true)
    try {
      await fetchJson("/api/desk/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "halt", reason }),
      })
      await onChanged()
      setReasonAnchor(null)
      setReasonDraft("")
    } finally {
      setLocalBusy(false)
    }
  }

  const runResume = async () => {
    setLocalBusy(true)
    try {
      await fetchJson("/api/desk/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      })
      setResumeOpen(false)
      await onChanged()
    } finally {
      setLocalBusy(false)
    }
  }

  if (deskHalted) {
    return (
      <>
        <ConfirmDialog
          open={resumeOpen}
          title="Resume new entries?"
          message="This clears the desk halt and turns Trading enabled back on. Flatten and stop-loss were never blocked."
          confirmLabel="Resume"
          confirmColor="warning"
          onConfirm={runResume}
          onCancel={() => setResumeOpen(false)}
        />
        <Button
          size="small"
          color="warning"
          variant="outlined"
          disabled={busy || localBusy}
          onClick={() => setResumeOpen(true)}
        >
          {compact ? "Resume" : "Resume…"}
        </Button>
      </>
    )
  }

  return (
    <>
      <Tooltip title="Stops new entries desk-wide with a stored reason. Flatten and stop-loss still work.">
        <Button
          size="small"
          color="error"
          variant="contained"
          disabled={busy || localBusy}
          aria-label="Halt new entries"
          startIcon={compact ? <BlockIcon fontSize="small" /> : undefined}
          onClick={async e => {
            await runHalt("Halted from status rail")
            setReasonAnchor(e.currentTarget)
          }}
        >
          {compact ? null : "Halt new entries"}
        </Button>
      </Tooltip>
      <Popover
        open={Boolean(reasonAnchor)}
        anchorEl={reasonAnchor}
        onClose={() => setReasonAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Stack spacing={1.5} sx={{ p: 2, width: 280 }}>
          <TextField
            size="small"
            label="Why? (optional)"
            value={reasonDraft}
            onChange={e => setReasonDraft(e.target.value)}
            placeholder={haltReason || "Add a reason"}
          />
          <Button
            size="small"
            variant="contained"
            disabled={!reasonDraft.trim() || localBusy}
            onClick={() => runHalt(reasonDraft.trim())}
          >
            Save reason
          </Button>
        </Stack>
      </Popover>
    </>
  )
}
