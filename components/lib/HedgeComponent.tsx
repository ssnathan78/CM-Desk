import { Checkbox, FormControlLabel, FormGroup, Grid, TextField } from "@mui/material"
import React from "react"
import { VOLATILITY_TYPE } from "../../lib/constants"
import FieldRow from "../forms/FieldRow"

const HedgeComponent = ({ volatilityType, isHedgeEnabled, hedgeDistance, onChange }) => {
  if (volatilityType === VOLATILITY_TYPE.LONG) {
    return null
  }

  return (
    <Grid size={12}>
      <FieldRow label="OTM hedge" wide>
        <FormGroup>
          <FormControlLabel
            key="isHedgeEnabled"
            label="Add OTM hedge"
            control={
              <Checkbox
                checked={isHedgeEnabled}
                onChange={() =>
                  onChange({
                    isHedgeEnabled: !isHedgeEnabled,
                  })
                }
              />
            }
          />
          {isHedgeEnabled ? (
            <FieldRow label="Hedge distance">
              <TextField
                fullWidth
                size="small"
                name="hedgeDistance"
                value={hedgeDistance}
                onChange={e => onChange({ hedgeDistance: +e.target.value || undefined })}
              />
            </FieldRow>
          ) : null}
        </FormGroup>
      </FieldRow>
    </Grid>
  )
}

export default HedgeComponent
