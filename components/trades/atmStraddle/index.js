import { Alert, Link as MuiLink } from "@mui/material"
import axios from "axios"
import NextLink from "next/link"
import { useRouter } from "next/router"
import { useState } from "react"
import { apiErrorMessage } from "../../../lib/apiClientError"
import {
  commonOnChangeHandler,
  formatFormDataForApi,
  getSchedulingStateProps,
} from "../../../lib/browserUtils"
import { INSTRUMENTS, STRATEGIES, STRATEGIES_DETAILS } from "../../../lib/constants"
import { jobsForPunch } from "../../../lib/punchSchedule"

import ConfirmAction from "../../lib/ConfirmAction"
import Form from "./TradeSetupForm"

const AtmStraddle = ({
  strategy = STRATEGIES.ATM_STRADDLE,

  enabledInstruments,

  exitStrategies,
}) => {
  const router = useRouter()

  const { heading } = STRATEGIES_DETAILS[strategy]

  const getDefaultState = () => ({
    ...STRATEGIES_DETAILS[strategy].defaultFormState,
    ...getSchedulingStateProps(strategy),
    instruments: {
      ...STRATEGIES_DETAILS[strategy].defaultFormState.instruments,
      [INSTRUMENTS.NIFTY]: true,
    },
  })

  const [state, setState] = useState(getDefaultState())
  const [submitError, setSubmitError] = useState(null)
  const [runNowOpen, setRunNowOpen] = useState(false)

  const submitJobs = async (formattedStateForApiProps = {}, runNow = false) => {
    const ready = jobsForPunch({
      instruments: state.instruments,
      lots: state.lots,
      lotsByInstrument: state.lotsByInstrument,
    })
    if (!ready.ok) {
      setSubmitError(ready.error)
      return
    }
    const instruments = ready.instruments

    function handleSyncJob(props) {
      return axios.post("/api/trades_day", formatFormDataForApi({ strategy, data: props }))
    }

    setSubmitError(null)
    try {
      await Promise.all(
        instruments.map(instrument => {
          const { instruments: _instruments, ...payload } = {
            ...state,
            ...formattedStateForApiProps,
            runNow,
          }
          return handleSyncJob({
            ...payload,
            lots: ready.lotsByInstrument[instrument] ?? payload.lots,
            instrument,
            strategy,
          })
        })
      )
      setState(getDefaultState())
      router.push("/desk?view=now&tab=today")
    } catch (e) {
      console.error(e)
      setSubmitError(apiErrorMessage(e, "Could not schedule this trade"))
    }
  }

  const onChange = props => commonOnChangeHandler(props, state, setState)

  const onSubmit = async (formattedStateForApiProps = {}, runNow = false) => {
    if (runNow) {
      setRunNowOpen(true)
      return
    }
    await submitJobs(formattedStateForApiProps, false)
  }

  const handleRunNow = () => setRunNowOpen(true)

  return (
    <>
      <ConfirmAction
        open={runNowOpen}
        tone="attention"
        title="Schedule immediately?"
        message="This will schedule this trade immediately. Are you sure?"
        confirmLabel="Schedule now"
        onCancel={() => setRunNowOpen(false)}
        onConfirm={async () => {
          setRunNowOpen(false)
          await submitJobs({}, true)
        }}
      />
      {submitError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}{" "}
          <MuiLink component={NextLink} href="/desk?view=why&tab=alerts" color="inherit">
            View Desk → Alerts
          </MuiLink>
        </Alert>
      ) : null}
      <Form
        strategy={strategy}
        state={state}
        onChange={onChange}
        onSubmit={onSubmit}
        onRunNow={handleRunNow}
        onCancel={() => router.push("/desk")}
        formHeading={heading}
        enabledInstruments={enabledInstruments}
        exitStrategies={exitStrategies}
      />
    </>
  )
}

export default AtmStraddle
