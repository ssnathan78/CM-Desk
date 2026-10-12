import { Alert, Snackbar } from "@mui/material"
import { useCallback, useState } from "react"

export function useSnackbar() {
  const [message, setMessage] = useState<string | null>(null)
  const [severity, setSeverity] = useState<"success" | "error" | "info">("info")

  const showMessage = useCallback((text: string, level: "success" | "error" | "info" = "info") => {
    setSeverity(level)
    setMessage(text)
  }, [])

  const SnackbarAlert = (
    <Snackbar
      key={message ? `${severity}:${message}` : "closed"}
      open={Boolean(message)}
      autoHideDuration={severity === "error" ? null : 4000}
      onClose={(_event, reason) => {
        if (severity === "error" && reason !== "escapeKeyDown") return
        setMessage(null)
      }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ mt: 7 }}
    >
      <Alert severity={severity} onClose={() => setMessage(null)} sx={{ width: "100%" }}>
        {message}
      </Alert>
    </Snackbar>
  )

  return { showMessage, SnackbarAlert }
}
