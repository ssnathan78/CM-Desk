import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material"
import React from "react"
import useSWR from "swr"

import {
  type EXIT_STRATEGIES,
  INSTRUMENTS,
  STRANGLE_ENTRY_STRATEGIES,
  STRATEGIES,
  STRATEGIES_DETAILS,
} from "../../../lib/constants"
import fetchJson from "../../../lib/fetchJson"
import { coerceLots } from "../../../lib/planMapper"
import {
  coerceScheduleableExitStrategy,
  EXIT_STRATEGIES_ALLOWED_AT_SCHEDULE,
  SCHEDULEABLE_EXIT_STRATEGIES,
  withIndexTick,
} from "../../../lib/strategyValidation"
import { labelFor } from "../../../lib/ui/labels"
import type { ATM_STRANGLE_CONFIG, AvailablePlansConfig } from "../../../types/plans"
import FieldRow from "../../forms/FieldRow"
import ExpiryTypeComponent from "../../lib/ExpiryTypeComponent"
import FormSection from "../../lib/FormSection"
import HedgeComponent from "../../lib/HedgeComponent"
import InstrumentPicker from "../../lib/InstrumentPicker"
import { OptionNotionalPreview } from "../../lib/NotionalPreview"
import ProductTypeComponent from "../../lib/ProductTypeComponent"
import RollbackComponent from "../../lib/RollbackComponent"
import DiscreteSlider from "../../lib/Slider"
import SlManagerComponent from "../../lib/SlManagerComponent"
import VolatilityTypeComponent from "../../lib/VolatilityTypeComponent"
import TradeTimePicker, { formatTradeScheduleLabel } from "../shared/TradeTimePicker"
import { useTradeFormSubmit } from "../shared/useTradeFormSubmit"

interface ATMStrangleTradeSetupFormProps {
  formHeading?: string
  strategy: STRATEGIES
  state: ATM_STRANGLE_CONFIG
  isRunnable?: boolean
  embedded?: boolean
  notice?: string | null
  onChange: (changedProps: Partial<ATM_STRANGLE_CONFIG>) => void
  onCancel: () => void
  onSubmit: (data: AvailablePlansConfig | null) => void
  onRunNow?: () => void
  enabledInstruments?: INSTRUMENTS[]
  exitStrategies?: EXIT_STRATEGIES[]
}

const TradeSetupForm = ({
  formHeading,
  strategy = STRATEGIES.ATM_STRANGLE,
  state,
  onChange,
  onSubmit,
  onRunNow,
  onCancel,
  isRunnable = true,
  embedded = false,
  notice = null,
  enabledInstruments: enabledInstrumentsProp,
  exitStrategies: exitStrategiesProp,
}: ATMStrangleTradeSetupFormProps) => {
  const isSchedulingDisabled = false

  const enabledInstruments = enabledInstrumentsProp ?? [
    INSTRUMENTS.NIFTY,
    INSTRUMENTS.BANKNIFTY,
    INSTRUMENTS.MIDCPNIFTY,
  ]

  const exitStrategies = (exitStrategiesProp ?? [...SCHEDULEABLE_EXIT_STRATEGIES]).filter(s =>
    EXIT_STRATEGIES_ALLOWED_AT_SCHEDULE.has(s)
  )

  React.useEffect(() => {
    if (!EXIT_STRATEGIES_ALLOWED_AT_SCHEDULE.has(state.exitStrategy)) {
      onChange({ exitStrategy: coerceScheduleableExitStrategy(state.exitStrategy) })
    }
  }, [state.exitStrategy, onChange])

  const entryStrategies = [
    STRANGLE_ENTRY_STRATEGIES.DISTANCE_FROM_ATM,
    STRANGLE_ENTRY_STRATEGIES.PERCENT_FROM_ATM,
    STRANGLE_ENTRY_STRATEGIES.ENTRY_PRICE,
  ]

  const { handleFormSubmit, formError, lotsError, instrumentError } = useTradeFormSubmit({
    state,
    strategy,
    embedded,
    notice,
    onChange,
    onSubmit,
  })
  const { data: riskData } = useSWR<{ settings?: { maxNotionalInr?: number } }>(
    "/api/desk/risk",
    fetchJson
  )
  const maxNotionalInr = Number(riskData?.settings?.maxNotionalInr) || 0

  const body = (
    <>
      {formHeading ? (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {formHeading}
        </Typography>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <FormSection
          title="Contract"
          hint="Name is a label. Index is the actual Nifty / BankNifty / FinNifty contract."
          helpHref="/help/strangle#contract"
        >
          <Grid container spacing={2}>
            <Grid size={12}>
              <FieldRow
                label="Template name"
                helper="Shown in the plan list. Does not change what is traded."
              >
                <TextField
                  size="small"
                  fullWidth
                  name="name"
                  value={state.name ?? ""}
                  onChange={e => onChange({ name: e.target.value })}
                />
              </FieldRow>
            </Grid>
            <Grid size={12}>
              <InstrumentPicker
                single={embedded}
                instruments={(embedded ? withIndexTick(state) : state).instruments}
                enabledInstruments={enabledInstruments}
                disabled={state.disableInstrumentChange}
                error={instrumentError}
                onChange={next => {
                  const instrument = (Object.keys(next) as INSTRUMENTS[]).find(key => next[key])
                  onChange({ instruments: next, ...(instrument ? { instrument } : {}) })
                }}
              />
            </Grid>
            <VolatilityTypeComponent state={state} onChange={onChange} />
            <ProductTypeComponent state={state} onChange={onChange} />
            <ExpiryTypeComponent state={state} onChange={onChange} />
            <Grid size={12}>
              <FieldRow
                label="Lots"
                helper={lotsError || "Default lots for every ticked index unless overridden below"}
              >
                <TextField
                  size="small"
                  fullWidth
                  name="lots"
                  value={state.lots ?? ""}
                  error={Boolean(lotsError)}
                  onChange={e => onChange({ lots: coerceLots(e.target.value) })}
                />
              </FieldRow>
            </Grid>
            {(Object.keys(state.instruments || {}) as INSTRUMENTS[])
              .filter(key => state.instruments?.[key])
              .map(instrument => (
                <Grid size={{ xs: 12, sm: 4 }} key={`lots-${instrument}`}>
                  <FieldRow label={`${labelFor(instrument)} lots`}>
                    <TextField
                      size="small"
                      fullWidth
                      value={state.lotsByInstrument?.[instrument] ?? state.lots ?? ""}
                      onChange={e => {
                        onChange({
                          lotsByInstrument: {
                            ...(state.lotsByInstrument || {}),
                            [instrument]: coerceLots(e.target.value),
                          },
                        })
                      }}
                    />
                  </FieldRow>
                </Grid>
              ))}
            <Grid size={12}>
              <FieldRow label="Notional preview" wide>
                <OptionNotionalPreview
                  lots={Number(state.lots) || 0}
                  instruments={state.instruments}
                  maxNotionalInr={maxNotionalInr}
                />
              </FieldRow>
            </Grid>
            <Grid size={12}>
              <FieldRow label="Inverted strangle" wide>
                <FormControlLabel
                  label="Sell the wing that is usually bought"
                  control={
                    <Checkbox
                      checked={state.inverted}
                      onChange={() => onChange({ inverted: !state.inverted })}
                    />
                  }
                />
              </FieldRow>
            </Grid>
          </Grid>
        </FormSection>

        <FormSection title="Risk" hint="Stops and hedges" helpHref="/help/strangle#risk">
          <Grid container spacing={2}>
            <SlManagerComponent state={state} onChange={onChange} exitStrategies={exitStrategies} />
            <HedgeComponent
              volatilityType={state.volatilityType}
              isHedgeEnabled={state.isHedgeEnabled}
              hedgeDistance={state.hedgeDistance}
              onChange={onChange}
            />
          </Grid>
        </FormSection>

        <FormSection title="Entry" hint="How far from ATM" helpHref="/help/strangle#entry">
          <Grid container spacing={2}>
            <Grid size={12}>
              <FieldRow label="Entry strategy" wide>
                <FormControl component="fieldset" sx={{ width: "100%" }}>
                  <RadioGroup
                    aria-label="entryStrategy"
                    name="entryStrategy"
                    value={state.entryStrategy}
                    onChange={e =>
                      onChange({
                        entryStrategy: e.target.value as STRANGLE_ENTRY_STRATEGIES,
                      })
                    }
                  >
                    {entryStrategies.map(entryStrategy => (
                      <FormControlLabel
                        key={entryStrategy}
                        value={entryStrategy}
                        control={<Radio size="small" />}
                        label={
                          <Typography variant="body2">
                            {STRATEGIES_DETAILS[STRATEGIES.ATM_STRANGLE].ENTRY_STRATEGY_DETAILS[
                              entryStrategy
                            ]?.label ?? entryStrategy}
                          </Typography>
                        }
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              </FieldRow>
            </Grid>
            <Grid size={12}>
              {state.entryStrategy === STRANGLE_ENTRY_STRATEGIES.DISTANCE_FROM_ATM ? (
                <FieldRow label="Strikes away from ATM" wide>
                  <DiscreteSlider
                    defaultValue={1}
                    step={1}
                    min={1}
                    max={20}
                    value={state.distanceFromAtm}
                    onChange={(e, newValue) => onChange({ distanceFromAtm: newValue })}
                  />
                </FieldRow>
              ) : state.entryStrategy === STRANGLE_ENTRY_STRATEGIES.PERCENT_FROM_ATM ? (
                <FieldRow label="Percent from ATM">
                  <TextField
                    size="small"
                    fullWidth
                    name="percentStrikes"
                    value={state.percentfromAtm}
                    defaultValue={2}
                    onChange={e => onChange({ percentfromAtm: +e.target.value || undefined })}
                  />
                </FieldRow>
              ) : (
                <FieldRow label="Option price">
                  <TextField
                    size="small"
                    fullWidth
                    name="optionPrice"
                    value={state.optionPrice}
                    defaultValue={20}
                    onChange={e => onChange({ optionPrice: +e.target.value || undefined })}
                  />
                </FieldRow>
              )}
            </Grid>
          </Grid>
        </FormSection>

        <FormSection title="Timing" hint="When to run and flatten" helpHref="/help/strangle#timing">
          <Grid container spacing={2}>
            <Grid size={12}>
              <FieldRow label="Auto square off" wide>
                <FormGroup>
                  <FormControlLabel
                    label="Enable auto square off"
                    control={
                      <Checkbox
                        checked={state.isAutoSquareOffEnabled}
                        onChange={() =>
                          onChange({
                            isAutoSquareOffEnabled: !state.isAutoSquareOffEnabled,
                          })
                        }
                      />
                    }
                  />
                  {state.isAutoSquareOffEnabled ? (
                    <FieldRow label="Square off time">
                      <TradeTimePicker
                        value={state.squareOffTime}
                        onChange={value => onChange({ squareOffTime: value })}
                      />
                    </FieldRow>
                  ) : null}
                </FormGroup>
              </FieldRow>
            </Grid>
            <RollbackComponent rollback={state.rollback!} onChange={onChange} />
            <Grid size={12}>
              <FieldRow label="Schedule run">
                <TradeTimePicker
                  disabled={isSchedulingDisabled}
                  value={isSchedulingDisabled ? undefined : state.runAt}
                  onChange={value => onChange({ runAt: value })}
                />
              </FieldRow>
            </Grid>
          </Grid>
        </FormSection>

        {!embedded ? (
          <FormSection title="Save" span>
            {formError ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                {formError}
              </Alert>
            ) : null}
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                position: "sticky",
                bottom: 0,
                py: 1,
                bgcolor: "background.paper",
              }}
            >
              {isRunnable ? (
                <Button variant="outlined" type="button" onClick={onRunNow}>
                  Schedule now
                </Button>
              ) : null}
              <Button
                variant="contained"
                type="button"
                onClick={handleFormSubmit}
                disabled={isSchedulingDisabled}
              >
                {isRunnable ? formatTradeScheduleLabel(state.runAt) : "Save template"}
              </Button>
              {!isRunnable ? (
                <Button type="button" onClick={onCancel}>
                  Cancel
                </Button>
              ) : null}
            </Box>
          </FormSection>
        ) : formError ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {formError}
          </Alert>
        ) : null}
      </Box>
    </>
  )

  if (embedded) {
    return <form noValidate>{body}</form>
  }

  return <form noValidate>{body}</form>
}
export default TradeSetupForm
