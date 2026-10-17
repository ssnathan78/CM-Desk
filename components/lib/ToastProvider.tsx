import { SnackbarProvider } from "notistack"
import type { ReactNode } from "react"

/** App-wide toasts (bottom-left). Dialog results should use inline/footer feedback when the control stays visible. */
export default function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <SnackbarProvider
      maxSnack={4}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      autoHideDuration={5000}
    >
      {children}
    </SnackbarProvider>
  )
}
