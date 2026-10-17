import ConfirmAction from "./ConfirmAction"

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: "primary" | "error" | "warning"
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tone =
    confirmColor === "error" ? "danger" : confirmColor === "warning" ? "attention" : "neutral"
  return (
    <ConfirmAction
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone={tone}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
