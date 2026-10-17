import { FormControl, FormControlLabel, Grid, Radio, RadioGroup, Typography } from "@mui/material"
import React from "react"
import { VOLATILITY_TYPE } from "../../lib/constants"
import { labelFor } from "../../lib/ui/labels"
import FieldRow from "../forms/FieldRow"

const VolatilityTypeComponent = ({ state, onChange }) => {
  const volTypes = [VOLATILITY_TYPE.SHORT, VOLATILITY_TYPE.LONG]
  return (
    <Grid size={12}>
      <FieldRow label="Vol type" wide>
        <FormControl component="fieldset" sx={{ width: "100%" }}>
          <RadioGroup
            aria-label="volatilityType"
            name="volatilityType"
            value={state.volatilityType}
            onChange={e => onChange({ volatilityType: e.target.value as VOLATILITY_TYPE })}
            row
          >
            {volTypes.map(volatilityType => (
              <FormControlLabel
                key={volatilityType}
                value={volatilityType}
                control={<Radio size="small" />}
                label={<Typography variant="body2">{labelFor(volatilityType)}</Typography>}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </FieldRow>
    </Grid>
  )
}

export default VolatilityTypeComponent
