import {
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material"
import { EXIT_STRATEGIES, EXIT_STRATEGIES_DETAILS } from "../../lib/constants"
import {
  EXIT_STRATEGIES_ALLOWED_AT_SCHEDULE,
  SCHEDULEABLE_EXIT_STRATEGIES,
} from "../../lib/strategyValidation"
import { labelFor } from "../../lib/ui/labels"
import FieldRow from "../forms/FieldRow"

const SlManagerComponent = ({ state, onChange, exitStrategies }) => {
  const visibleExits = (
    exitStrategies?.length ? exitStrategies : SCHEDULEABLE_EXIT_STRATEGIES
  ).filter((exitStrategy: EXIT_STRATEGIES) => EXIT_STRATEGIES_ALLOWED_AT_SCHEDULE.has(exitStrategy))
  const selectedExit = visibleExits.includes(state.exitStrategy)
    ? state.exitStrategy
    : visibleExits[0]

  return (
    <>
      <Grid size={12}>
        <FieldRow label="Exit strategy" wide>
          <FormControl component="fieldset" sx={{ width: "100%" }}>
            <RadioGroup
              aria-label="exitStrategy"
              name="exitStrategy"
              value={selectedExit}
              onChange={e =>
                onChange({
                  exitStrategy: e.target.value as EXIT_STRATEGIES,
                  isMaxLossEnabled: false,
                  isMaxProfitEnabled: false,
                })
              }
            >
              {visibleExits.map(exitStrategy => (
                <FormControlLabel
                  key={exitStrategy}
                  value={exitStrategy}
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2">
                      {EXIT_STRATEGIES_DETAILS[exitStrategy]?.label ?? labelFor(exitStrategy)}
                    </Typography>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>
        </FieldRow>
      </Grid>
      {selectedExit === EXIT_STRATEGIES.INDIVIDUAL_LEG_SLM_1X ? (
        <Grid size={12}>
          <FieldRow label="SL %">
            <TextField
              fullWidth
              size="small"
              name="slmPercent"
              value={state.slmPercent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ slmPercent: +e.target.value || undefined })
              }
            />
          </FieldRow>
        </Grid>
      ) : null}
    </>
  )
}

export default SlManagerComponent
