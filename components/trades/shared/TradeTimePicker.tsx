import { TimePicker } from "@mui/x-date-pickers/TimePicker"
import dayjs from "dayjs"

import { ensureIST } from "../../../lib/browserUtils"

export default function TradeTimePicker({
  label,
  value,
  disabled,
  onChange,
}: {
  label?: string
  value: string | null | undefined
  disabled?: boolean
  onChange: (iso: string | undefined) => void
}) {
  return (
    <TimePicker
      ampm={false}
      label={label ?? ""}
      disabled={disabled}
      value={value ? dayjs(value) : null}
      onChange={selectedDate => {
        onChange(selectedDate ? ensureIST(selectedDate) : undefined)
      }}
      slotProps={{
        textField: {
          margin: "normal",
          size: "small",
          fullWidth: true,
        },
      }}
    />
  )
}

export function formatTradeScheduleLabel(runAt: string | undefined) {
  const time = runAt ? dayjs(runAt).format("HH:mm") : "—"
  return `Schedule for ${time}`
}
