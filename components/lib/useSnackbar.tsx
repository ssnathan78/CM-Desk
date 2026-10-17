import { useSnackbar as useNotistack } from "notistack"
import { useCallback } from "react"

export function useSnackbar() {
  const { enqueueSnackbar, closeSnackbar } = useNotistack()

  const showMessage = useCallback(
    (text: string, level: "success" | "error" | "info" = "info") => {
      const variant = level === "error" ? "error" : level === "success" ? "success" : "info"
      enqueueSnackbar(text, {
        variant,
        persist: level === "error",
        preventDuplicate: true,
      })
    },
    [enqueueSnackbar]
  )

  return { showMessage, closeSnackbar }
}
