import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
} from "@mui/material"

import { INSTRUMENT_DETAILS, type INSTRUMENTS } from "../../lib/constants"
import FieldRow from "../forms/FieldRow"

export default function InstrumentPicker({
  instruments,
  enabledInstruments,
  disabled,
  single,
  hint,
  error,
  onChange,
}: {
  instruments: Record<INSTRUMENTS, boolean>
  enabledInstruments: INSTRUMENTS[]
  disabled?: boolean
  single?: boolean
  hint?: string
  error?: string | null
  onChange: (instruments: Record<INSTRUMENTS, boolean>) => void
}) {
  const selected =
    (Object.keys(instruments || {}) as INSTRUMENTS[]).find(key => instruments?.[key]) || ""

  const helper =
    error ??
    hint ??
    (single
      ? "This template trades one index. The name is unique across templates."
      : "Tick every index you want to punch now. Each tick becomes its own order. Name above is only a label.")

  return (
    <FieldRow label="Index" wide helper={helper}>
      <FormControl component="fieldset" error={Boolean(error)} sx={{ width: "100%" }}>
        {single ? (
          <RadioGroup
            row
            sx={{ flexWrap: "wrap" }}
            value={selected}
            onChange={e => {
              const next = e.target.value as INSTRUMENTS
              onChange(
                enabledInstruments.reduce(
                  (accum, instrument) => ({ ...accum, [instrument]: instrument === next }),
                  {} as Record<INSTRUMENTS, boolean>
                )
              )
            }}
          >
            {enabledInstruments.map(instrument => (
              <FormControlLabel
                key={instrument}
                value={instrument}
                disabled={disabled}
                control={<Radio size="small" />}
                label={INSTRUMENT_DETAILS[instrument].displayName}
              />
            ))}
          </RadioGroup>
        ) : (
          <FormGroup row sx={{ flexWrap: "wrap" }}>
            {enabledInstruments.map(instrument => (
              <FormControlLabel
                key={instrument}
                label={INSTRUMENT_DETAILS[instrument].displayName}
                control={
                  <Checkbox
                    size="small"
                    disabled={disabled}
                    checked={Boolean(instruments[instrument])}
                    onChange={() =>
                      onChange({
                        ...instruments,
                        [instrument]: !instruments[instrument],
                      })
                    }
                  />
                }
              />
            ))}
          </FormGroup>
        )}
      </FormControl>
    </FieldRow>
  )
}
