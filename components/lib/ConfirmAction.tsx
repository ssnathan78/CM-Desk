import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material"
import { useEffect, useRef, useState } from "react"

import BookBadge from "../figures/BookBadge"
import { color } from "../../src/tokens"

export type ConfirmActionProps = {
  open: boolean
  tone?: "attention" | "danger" | "neutral"
  title: string
  book?: "LIVE" | "PAPER" | "MOCK"
  will?: string[]
  willNot?: string[]
  note?: string
  message?: string
  confirmLabel: string
  cancelLabel?: string
  defaultFocus?: "cancel" | "confirm"
  busy?: boolean
  error?: string | null
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmAction({
  open,
  tone = "neutral",
  title,
  book,
  will,
  willNot,
  note,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  defaultFocus = "cancel",
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmActionProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [localBusy, setLocalBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      if (defaultFocus === "confirm") confirmRef.current?.focus()
      else cancelRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open, defaultFocus])

  const confirmColor = tone === "danger" ? "error" : tone === "attention" ? "warning" : "primary"
  const confirmSx =
    tone === "danger"
      ? { bgcolor: color.danger.main, "&:hover": { bgcolor: color.danger.hover } }
      : undefined

  async function handleConfirm() {
    setLocalBusy(true)
    try {
      await onConfirm()
    } finally {
      setLocalBusy(false)
    }
  }

  const working = busy || localBusy

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {title}
        {book ? <BookBadge book={book} /> : null}
      </DialogTitle>
      <DialogContent>
        {message ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: will?.length ? 1.5 : 0 }}>
            {message}
          </Typography>
        ) : null}
        {will?.length ? (
          <Box sx={{ mb: willNot?.length ? 1 : 0 }}>
            <Typography variant="overline" color="text.secondary">Will</Typography>
            <List dense disablePadding>
              {will.map(line => (
                <ListItem key={line} disablePadding>
                  <ListItemText primary={line} />
                </ListItem>
              ))}
            </List>
          </Box>
        ) : null}
        {willNot?.length ? (
          <Box>
            <Typography variant="overline" color="text.secondary">Will not</Typography>
            <List dense disablePadding>
              {willNot.map(line => (
                <ListItem key={line} disablePadding>
                  <ListItemText primary={line} />
                </ListItem>
              ))}
            </List>
          </Box>
        ) : null}
        {note ? (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1.5 }}>
            {note}
          </Typography>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 2, pb: 2 }}>
        <Button ref={cancelRef} onClick={onCancel} disabled={working}>
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          color={confirmColor}
          variant="contained"
          sx={confirmSx}
          disabled={working}
          onClick={() => void handleConfirm()}
        >
          {working ? "Working…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
