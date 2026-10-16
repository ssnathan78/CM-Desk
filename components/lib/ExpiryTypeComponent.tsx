import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material"
import { useEffect } from "react"
import useSWR from "swr"
import { EXPIRY_TYPE, expiryTypesForInstrument, type INSTRUMENTS } from "../../lib/constants"
import { expiryRuleLabel } from "../../lib/expiryRule"
import fetchJson from "../../lib/fetchJson"

const ExpiryTypeComponent = ({ state, onChange }) => {
  const instrument = state.instrument as INSTRUMENTS | undefined
  const expiryTypes = expiryTypesForInstrument(instrument)
  const { data: preview } = useSWR<Record<string, string | null>>(
    instrument ? `/api/expiry-preview?instrument=${instrument}` : null,
    fetchJson
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the instrument's allowed expiries change
  useEffect(() => {
    if (state.expiryType && !expiryTypes.includes(state.expiryType)) {
      onChange({ expiryType: EXPIRY_TYPE.CURRENT })
    }
  }, [instrument, state.expiryType, expiryTypes])

  return (
    <Grid size={12}>
      <FormControl component="fieldset">
        <FormLabel component="legend">Option expiry</FormLabel>
        <RadioGroup
          aria-label="expiryTypes"
          name="expiryType"
          value={expiryTypes.includes(state.expiryType) ? state.expiryType : EXPIRY_TYPE.CURRENT}
          onChange={e => onChange({ expiryType: e.target.value as EXPIRY_TYPE })}
          row
        >
          {expiryTypes.map(expiryType => {
            const when = preview?.[expiryType]
            return (
              <FormControlLabel
                key={expiryType}
                value={expiryType}
                control={<Radio size="small" />}
                label={
                  <Typography variant="body2">
                    {expiryRuleLabel(instrument, expiryType)}
                    {when ? ` · ${when}` : preview ? " · not listed" : ""}
                  </Typography>
                }
              />
            )
          })}
        </RadioGroup>
        <Typography variant="caption" color="text.secondary">
          The template stores this rule. The contract date is chosen when the job fires, so the
          template stays after this expiry.
        </Typography>
      </FormControl>
    </Grid>
  )
}

export default ExpiryTypeComponent
