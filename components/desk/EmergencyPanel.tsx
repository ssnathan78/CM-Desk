import BlockIcon from "@mui/icons-material/Block"
import CallMissedOutgoingIcon from "@mui/icons-material/CallMissedOutgoing"
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined"
import { Box, Button, Typography } from "@mui/material"
import { useState } from "react"

import fetchJson, { type FetchJsonError } from "../../lib/fetchJson"
import { type FlattenOpenResult, flattenOperatorNotice } from "../../lib/flattenNotice"
import { color } from "../../src/tokens"
import ConfirmAction from "../lib/ConfirmAction"
import { useSnackbar } from "../lib/useSnackbar"

const KILL_MESSAGES = {
  flatten: {
    will: [
      "Flatten every currently open book (straddle, strangle, and Chase).",
      "Paper books flatten even when the market is closed.",
    ],
    willNot: ["Halt the desk.", "Pause Chase (it can take the next signal after flatten)."],
    note: "A live book is refused while the market is closed. The position and its stop stay.",
  },
  intraday: {
    will: ["Flatten today's straddles and strangles and abort those jobs.", "Halt the desk."],
    willNot: ["Pause Chase.", "Flatten Chase books."],
    note: "A live intraday book is refused while the market is closed. Those positions and stops stay. The halt still happens.",
  },
  all: {
    will: ["Flatten every open book.", "Pause Chase.", "Halt the desk."],
    willNot: [],
    note: "A live book is refused while the market is closed. Chase may stay LONG or SHORT. Pause and halt still happen.",
  },
} as const

type Scope = keyof typeof KILL_MESSAGES

export default function EmergencyPanel({ onDone }: { onDone: () => Promise<void> }) {
  const [pendingScope, setPendingScope] = useState<Scope | null>(null)
  const [loading, setLoading] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const { showMessage } = useSnackbar()

  const runAction = async () => {
    if (!pendingScope) return
    setLoading(true)
    setDialogError(null)
    try {
      if (pendingScope === "flatten") {
        const result = await fetchJson<FlattenOpenResult>("/api/desk/flatten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        })
        const notice = flattenOperatorNotice(result, "Open books squared off.")
        if (notice.severity === "error") showMessage(notice.text, "error")
      } else {
        const result = await fetchJson<{ liveLeftOpen?: boolean; scope?: string }>(
          "/api/kill-desk",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scope: pendingScope }),
          }
        )
        if (result.liveLeftOpen) {
          showMessage(
            pendingScope === "all"
              ? "Market is closed. Live books were left open with their stops. Chase is paused and the desk is halted."
              : "Market is closed. Live intraday books were left open with their stops. The desk is halted. Chase was not paused.",
            "error"
          )
        }
      }
      setPendingScope(null)
      await onDone()
    } catch (e) {
      const err = e as FetchJsonError
      setDialogError(
        (err.data as { error?: string })?.error || err.message || "Could not complete the action"
      )
    } finally {
      setLoading(false)
    }
  }

  const copy = pendingScope ? KILL_MESSAGES[pendingScope] : null

  return (
    <Box
      sx={{
        border: `1px solid ${color.danger.subtle}`,
        borderRadius: 1,
        p: 2,
        bgcolor: color.bg.surface,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Emergency
      </Typography>
      <ConfirmAction
        open={Boolean(pendingScope)}
        tone={
          pendingScope === "all" ? "danger" : pendingScope === "intraday" ? "danger" : "attention"
        }
        title={
          pendingScope === "flatten"
            ? "Square off every open book?"
            : pendingScope === "all"
              ? "Kill every job, pause Chase, and halt the desk?"
              : "Kill today's straddles and strangles and halt the desk?"
        }
        will={copy?.will ? [...copy.will] : undefined}
        willNot={copy?.willNot ? [...copy.willNot] : undefined}
        note={copy?.note}
        confirmLabel={
          pendingScope === "flatten"
            ? "Square off all"
            : pendingScope === "all"
              ? "Kill all"
              : "Kill intraday"
        }
        defaultFocus="cancel"
        busy={loading}
        error={dialogError}
        onConfirm={runAction}
        onCancel={() => {
          setPendingScope(null)
          setDialogError(null)
        }}
      />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          color="warning"
          variant="outlined"
          startIcon={<CallMissedOutgoingIcon />}
          onClick={() => setPendingScope("flatten")}
        >
          Square off all open books
        </Button>
        <Button
          color="error"
          variant="outlined"
          startIcon={<StopCircleOutlinedIcon />}
          onClick={() => setPendingScope("intraday")}
        >
          Kill intraday
        </Button>
        <Button
          variant="contained"
          startIcon={<BlockIcon />}
          onClick={() => setPendingScope("all")}
          sx={{
            bgcolor: color.danger.main,
            "&:hover": { bgcolor: color.danger.hover },
          }}
        >
          Kill all (incl. Chase)
        </Button>
      </Box>
    </Box>
  )
}
