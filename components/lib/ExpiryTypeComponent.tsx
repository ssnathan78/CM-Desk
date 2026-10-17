import { FormControl, FormControlLabel, Grid, Radio, RadioGroup, Typography } from "@mui/material"
import { useEffect } from "react"
import useSWR from "swr"
import { EXPIRY_TYPE, expiryTypesForInstrument, type INSTRUMENTS } from "../../lib/constants"
import { expiryRuleLabel } from "../../lib/expiryRule"
import fetchJson from "../../lib/fetchJson"
import FieldRow from "../forms/FieldRow"

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
      <FieldRow
        label="Option expiry"
        wide
        helper="The template stores this rule. The contract date is chosen when the job fires, so the template stays after this expiry."
      >
        <FormControl component="fieldset" sx={{ width: "100%" }}>
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
        </FormControl>
      </FieldRow>
    </Grid>
  )
}

export default ExpiryTypeComponent
