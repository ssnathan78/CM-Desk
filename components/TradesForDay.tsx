import { Box, Button, Paper, Typography } from "@mui/material"
import router from "next/router"
import type React from "react"
import { useState } from "react"
import useSWR, { mutate } from "swr"

import { STRATEGIES_DETAILS } from "../lib/constants"
import { dashboardJobActions, isJobAborted } from "../lib/dashboardJobActions"
import fetchJson, { type FetchJsonError } from "../lib/fetchJson"
import { type FlattenOpenResult, flattenOperatorNotice } from "../lib/flattenNotice"
import { operatorJobError } from "../lib/operatorJobError"
import EmergencyPanel from "./desk/EmergencyPanel"
import BrokerOrders from "./lib/brokerOrders"
import ConfirmDialog from "./lib/ConfirmDialog"
import PnLComponent from "./lib/PnLComponent"
import TradeDetails from "./lib/tradeDetails"
import { useSnackbar } from "./lib/useSnackbar"

const HeadingWithError = ({ heading, error }: { heading?: string; error: string }) => (
  <>
    <Typography component="p" color="error">
      {error}
    </Typography>
    <Typography component="p">{heading}</Typography>
  </>
)

type TradeJob = {
  id: string
  strategy: string
  status?: string
  name?: string
  instrument?: string
  orderTag?: string
  status_message?: string
  userOverride?: string | null
  user_override?: string | null
  queue?: { id?: string }
  detailsComponent: (strategy: string, jobDetails: unknown) => React.ReactNode
}

const WrapperComponent = (props: TradeJob) => {
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [flattenOpen, setFlattenOpen] = useState(false)
  const [flattenLoading, setFlattenLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { showMessage, SnackbarAlert } = useSnackbar()

  const isChase = props.strategy === "CHASE"
  const jobWasQueued = props.status !== "REJECT" && props.queue?.id
  const { data: jobDetails } = useSWR(
    jobWasQueued && !isChase ? `/api/get_job?id=${props.queue?.id}` : null
  )

  const { data: jobOrders } = useSWR(
    props.orderTag ? `/api/get_orders?order_tag=${props.orderTag}` : null
  )

  const { data: pnlData } = useSWR(props.orderTag ? `/api/pnl?order_tag=${props.orderTag}` : null)

  const strategyDetails = STRATEGIES_DETAILS[props.strategy as keyof typeof STRATEGIES_DETAILS]
  const aborted = isJobAborted(props)

  const Heading = () => {
    if (isChase) {
      return <Typography component="p">Chase · Scheduled</Typography>
    }

    if (aborted) {
      return (
        <Typography component="p">Stopped · {props.name || strategyDetails?.heading}</Typography>
      )
    }

    if (!jobWasQueued) {
      const message = operatorJobError(
        typeof props.status_message === "string" ? props.status_message : "Unknown error"
      )
      return (
        <HeadingWithError
          error={message || "Unknown error"}
          heading={props.name || strategyDetails?.heading}
        />
      )
    }

    if (jobWasQueued && (jobDetails as { current_state?: string })?.current_state === "failed") {
      const message = operatorJobError(
        (jobDetails as { job?: { failedReason?: string } })?.job?.failedReason || "Failed"
      )
      return (
        <HeadingWithError
          error={message || "Failed"}
          heading={props.name || strategyDetails?.heading}
        />
      )
    }

    return (
      <Typography component="p">
        #{props.queue?.id} · {props.name}
      </Typography>
    )
  }

  const handleDeleteTrade = async (tradeId: string) => {
    try {
      await fetchJson("/api/trades_day", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tradeId }),
      })
      await mutate("/api/trades_day")
    } catch (e) {
      const err = e as FetchJsonError
      showMessage(
        (err.data as { error?: string })?.error || err.message || "Could not delete job",
        "error"
      )
    }
  }

  const handleSquareOff = async () => {
    setFlattenLoading(true)
    try {
      const result = await fetchJson<FlattenOpenResult>("/api/desk/flatten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isChase ? { strategy: "CHASE" } : { jobId: props.id }),
      })
      setFlattenOpen(false)
      await mutate("/api/trades_day")
      const notice = flattenOperatorNotice(
        result,
        isChase
          ? "Chase squared off. The next signal can still be taken unless you pause or halt."
          : "Position squared off."
      )
      showMessage(notice.text, notice.severity)
    } catch (e) {
      const err = e as FetchJsonError
      showMessage(
        (err.data as { error?: string })?.error || err.message || "Could not square off",
        "error"
      )
    } finally {
      setFlattenLoading(false)
    }
  }

  const { showDelete, showSquareOff } = dashboardJobActions({
    jobWasQueued: Boolean(jobWasQueued),
    isChase,
    jobState: (jobDetails as { current_state?: string })?.current_state,
    jobMissing: (jobDetails as { error?: string })?.error === "job not found",
    aborted,
    hasSettledPnl: typeof (pnlData as { pnl?: number })?.pnl === "number",
  })

  return (
    <Paper sx={{ mb: 1, px: 1.5, py: 1 }}>
      {SnackbarAlert}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2">
            <Heading />
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {[props.instrument, props.status, strategyDetails?.heading].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
          <Button size="small" onClick={() => setExpanded(open => !open)}>
            {expanded ? "Hide" : "Details"}
          </Button>
          {showDelete ? (
            <Button
              size="small"
              variant="outlined"
              loading={deleteLoading}
              onClick={async () => {
                setDeleteLoading(true)
                await handleDeleteTrade(props.id)
                setDeleteLoading(false)
              }}
            >
              Delete
            </Button>
          ) : null}
          {showSquareOff ? (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              loading={flattenLoading}
              onClick={() => setFlattenOpen(true)}
            >
              Square off
            </Button>
          ) : null}
        </Box>
      </Box>

      <ConfirmDialog
        open={flattenOpen}
        title={isChase ? "Square off Chase?" : "Square off this trade?"}
        message={
          isChase
            ? "This flattens the current Chase futures book and returns Chase to AWAITING_SIGNAL. The next hourly job can still take a new signal. It does not pause Chase or halt the desk."
            : "This flattens the open legs for this job and stops further punches on it. It does not halt the desk. Chase is left running."
        }
        confirmLabel="Square off"
        confirmColor="warning"
        onConfirm={() => void handleSquareOff()}
        onCancel={() => setFlattenOpen(false)}
      />

      {expanded ? (
        <Box sx={{ mt: 1 }}>{props.detailsComponent(props.strategy, jobDetails)}</Box>
      ) : null}

      {expanded && jobWasQueued && !isChase ? (
        <Box sx={{ mb: 1 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="subtitle2">
              Live status —{" "}
              {(jobDetails as { current_state?: string })?.current_state?.toUpperCase() ||
                (jobDetails as { error?: string })?.error ||
                "Loading..."}
            </Typography>
            {typeof (pnlData as { pnl?: number })?.pnl === "number" ? (
              <PnLComponent
                pnl={(pnlData as { pnl: number }).pnl}
                points={(pnlData as { points?: number }).points}
              />
            ) : null}
          </Box>
        </Box>
      ) : null}

      {expanded && Array.isArray(jobOrders) && jobOrders.length ? (
        <BrokerOrders orders={jobOrders as never[]} />
      ) : null}
    </Paper>
  )
}

const TradesForDay = () => {
  const {
    data: trades,
    error,
    mutate: reloadTrades,
  } = useSWR("/api/trades_day", {
    refreshInterval: 10000,
  })

  if (error) {
    return <Typography color="error">Could not load today&apos;s trades. Retry shortly.</Typography>
  }

  if (!trades?.length) {
    return (
      <>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Nothing scheduled today
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Run a weekday template or open a new structure. Chase may still be running.
          </Typography>
          <Button sx={{ mr: 1 }} onClick={() => router.push("/plan")}>
            Schedules
          </Button>
          <Button variant="contained" onClick={() => router.push("/templates")}>
            New template
          </Button>
        </Paper>
        <EmergencyPanel onDone={() => reloadTrades()} />
      </>
    )
  }

  return (
    <>
      <EmergencyPanel onDone={() => reloadTrades()} />
      <Box>
        {trades.map((trade: TradeJob) => (
          <WrapperComponent
            key={trade.id}
            {...trade}
            detailsComponent={(strategy, jobDetails) => (
              <TradeDetails
                strategy={strategy}
                tradeDetails={trade}
                jobDetails={(jobDetails ?? {}) as Record<string, unknown>}
              />
            )}
          />
        ))}
      </Box>
    </>
  )
}

export default TradesForDay
