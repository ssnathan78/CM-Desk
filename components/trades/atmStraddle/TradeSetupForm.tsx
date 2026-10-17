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

import { type EXIT_STRATEGIES, INSTRUMENTS, STRATEGIES } from "../../../lib/constants"
import fetchJson from "../../../lib/fetchJson"
import { coerceLots } from "../../../lib/planMapper"
import {
  coerceScheduleableExitStrategy,
  EXIT_STRATEGIES_ALLOWED_AT_SCHEDULE,
  SCHEDULEABLE_EXIT_STRATEGIES,
  withIndexTick,
} from "../../../lib/strategyValidation"
import { labelFor } from "../../../lib/ui/labels"
import type { ATM_STRADDLE_CONFIG, AvailablePlansConfig } from "../../../types/plans"
import FieldRow from "../../forms/FieldRow"
import ExpiryTypeComponent from "../../lib/ExpiryTypeComponent"
import FormSection from "../../lib/FormSection"
import HedgeComponent from "../../lib/HedgeComponent"
import InstrumentPicker from "../../lib/InstrumentPicker"
import { OptionNotionalPreview } from "../../lib/NotionalPreview"
import ProductTypeComponent from "../../lib/ProductTypeComponent"
import RollbackComponent from "../../lib/RollbackComponent"
import SlManagerComponent from "../../lib/SlManagerComponent"
import VolatilityTypeComponent from "../../lib/VolatilityTypeComponent"
import TradeTimePicker, { formatTradeScheduleLabel } from "../shared/TradeTimePicker"
import { useTradeFormSubmit } from "../shared/useTradeFormSubmit"

interface ATMStraddleTradeSetupFormProps {
  formHeading?: string
  strategy: STRATEGIES
  state: ATM_STRADDLE_CONFIG
  isRunnable?: boolean
  embedded?: boolean
  notice?: string | null
  onChange: (changedProps: Partial<ATM_STRADDLE_CONFIG>) => void
  onCancel: () => void
  onSubmit: (data: AvailablePlansConfig | null) => void
  onRunNow?: () => void
  enabledInstruments?: INSTRUMENTS[]
  exitStrategies?: EXIT_STRATEGIES[]
}

const TradeSetupForm = ({
  formHeading,
  strategy = STRATEGIES.ATM_STRADDLE,
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
}: ATMStraddleTradeSetupFormProps) => {
  const isSchedulingDisabled = false

  const enabledInstruments =
    enabledInstrumentsProp ??
    (strategy === STRATEGIES.ATM_STRADDLE
      ? [INSTRUMENTS.NIFTY, INSTRUMENTS.BANKNIFTY, INSTRUMENTS.FINNIFTY, INSTRUMENTS.MIDCPNIFTY]
      : [INSTRUMENTS.NIFTY, INSTRUMENTS.BANKNIFTY, INSTRUMENTS.MIDCPNIFTY])

  const exitStrategies = (exitStrategiesProp ?? [...SCHEDULEABLE_EXIT_STRATEGIES]).filter(s =>
    EXIT_STRATEGIES_ALLOWED_AT_SCHEDULE.has(s)
  )

  React.useEffect(() => {
    if (!EXIT_STRATEGIES_ALLOWED_AT_SCHEDULE.has(state.exitStrategy)) {
      onChange({ exitStrategy: coerceScheduleableExitStrategy(state.exitStrategy) })
    }
  }, [state.exitStrategy, onChange])

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
          helpHref="/help/straddle#contract"
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
          </Grid>
        </FormSection>

        <FormSection
          title="Risk"
          hint="Stops, hedges, point targets"
          helpHref="/help/straddle#risk"
        >
          <Grid container spacing={2}>
            <SlManagerComponent state={state} onChange={onChange} exitStrategies={exitStrategies} />
            <HedgeComponent
              volatilityType={state.volatilityType}
              isHedgeEnabled={state.isHedgeEnabled}
              hedgeDistance={state.hedgeDistance}
              onChange={onChange}
            />
            <Grid size={12}>
              <FieldRow
                label="Loss floor (pts)"
                wide
                helper="Exit when combined points fall below this. Usually negative (e.g. −18). After a profit trail it moves up."
              >
                <FormGroup>
                  <FormControlLabel
                    label="Square off if losses breach (points)"
                    control={
                      <Checkbox
                        checked={state.isMaxLossEnabled}
                        onChange={() =>
                          onChange({
                            isMaxLossEnabled: !state.isMaxLossEnabled,
                          })
                        }
                      />
                    }
                  />
                  {state.isMaxLossEnabled ? (
                    <TextField
                      size="small"
                      fullWidth
                      name="maxLossPoints"
                      value={state.trailingMaxLossPoints}
                      onChange={e =>
                        onChange({
                          trailingMaxLossPoints: +e.target.value || undefined,
                        })
                      }
                    />
                  ) : null}
                </FormGroup>
              </FieldRow>
            </Grid>
            <Grid size={12}>
              <FieldRow
                label="Profit target (pts)"
                wide
                helper="On breach, the trail-up % raises the target."
              >
                <FormGroup>
                  <FormControlLabel
                    label="Square off if profits breach (points)"
                    control={
                      <Checkbox
                        checked={state.isMaxProfitEnabled}
                        onChange={() =>
                          onChange({
                            isMaxProfitEnabled: !state.isMaxProfitEnabled,
                          })
                        }
                      />
                    }
                  />
                  {state.isMaxProfitEnabled ? (
                    <>
                      <FieldRow label="Max profit (points)">
                        <TextField
                          size="small"
                          fullWidth
                          name="maxProfitPoints"
                          value={state.trailingMaxProfitPoints}
                          onChange={e =>
                            onChange({
                              trailingMaxProfitPoints: +e.target.value || undefined,
                            })
                          }
                        />
                      </FieldRow>
                      <FieldRow label="Profit trail-up %">
                        <TextField
                          size="small"
                          fullWidth
                          name="trailingProfitPercent"
                          value={state.trailingProfitPercent}
                          onChange={e =>
                            onChange({
                              trailingProfitPercent: +e.target.value || undefined,
                            })
                          }
                        />
                      </FieldRow>
                    </>
                  ) : null}
                </FormGroup>
              </FieldRow>
            </Grid>
          </Grid>
        </FormSection>

        <FormSection title="Entry" hint="Skew wait before punching" helpHref="/help/straddle#entry">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FieldRow label="Ideal skew %">
                <TextField
                  size="small"
                  fullWidth
                  name="maxSkewPercent"
                  value={state.maxSkewPercent}
                  onChange={e => onChange({ maxSkewPercent: +e.target.value || undefined })}
                />
              </FieldRow>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FieldRow label="Threshold skew %">
                <TextField
                  size="small"
                  fullWidth
                  name="thresholdSkewPercent"
                  value={state.thresholdSkewPercent}
                  onChange={e => onChange({ thresholdSkewPercent: +e.target.value || undefined })}
                />
              </FieldRow>
            </Grid>
            <Grid size={12}>
              <FieldRow label="Skew checker (minutes)">
                <TextField
                  size="small"
                  fullWidth
                  name="expireIfUnsuccessfulInMins"
                  value={state.expireIfUnsuccessfulInMins}
                  onChange={e =>
                    onChange({
                      expireIfUnsuccessfulInMins: +e.target.value || undefined,
                    })
                  }
                />
              </FieldRow>
            </Grid>
            <Grid size={12}>
              <FieldRow label="If skew never converges" wide>
                <FormControl component="fieldset" sx={{ width: "100%" }}>
                  <RadioGroup
                    aria-label="takeTradeIrrespectiveSkew"
                    name="takeTradeIrrespectiveSkew"
                    value={state.takeTradeIrrespectiveSkew}
                    onChange={() =>
                      onChange({
                        takeTradeIrrespectiveSkew: !state.takeTradeIrrespectiveSkew,
                      })
                    }
                  >
                    <FormControlLabel
                      value={false}
                      control={<Radio size="small" />}
                      label={<Typography variant="body2">Reject the trade</Typography>}
                    />
                    <FormControlLabel
                      value
                      control={<Radio size="small" />}
                      label={<Typography variant="body2">Enter anyway</Typography>}
                    />
                  </RadioGroup>
                </FormControl>
              </FieldRow>
            </Grid>
          </Grid>
        </FormSection>

        <FormSection title="Timing" hint="When to run and flatten" helpHref="/help/straddle#timing">
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
