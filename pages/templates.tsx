import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material"
import axios from "axios"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import Layout from "../components/Layout"
import { useSnackbar } from "../components/lib/useSnackbar"
import ATMStraddleTradeForm from "../components/trades/atmStraddle/TradeSetupForm"
import ATMStrangleTradeForm from "../components/trades/atmStrangle/TradeSetupForm"
import { apiErrorMessage } from "../lib/apiClientError"
import { formatFormDataForApi, getSchedulingStateProps } from "../lib/browserUtils"
import { INSTRUMENTS, STRATEGIES, STRATEGIES_DETAILS } from "../lib/constants"
import fetchJson from "../lib/fetchJson"
import { hydratePlanConfig } from "../lib/planClient"
import useUser from "../lib/useUser"
import type { AvailablePlansConfig } from "../types/plans"

type TemplateRow = AvailablePlansConfig & { id: string }

const blankState = (
  strategy: typeof STRATEGIES.ATM_STRADDLE | typeof STRATEGIES.ATM_STRANGLE
): AvailablePlansConfig =>
  hydratePlanConfig({
    ...STRATEGIES_DETAILS[strategy].defaultFormState,
    ...getSchedulingStateProps(strategy),
    strategy,
    name: "",
    instrument: INSTRUMENTS.NIFTY,
    instruments: {
      ...STRATEGIES_DETAILS[strategy].defaultFormState.instruments,
      [INSTRUMENTS.NIFTY]: true,
    },
  })

export default function TemplatesPage() {
  useUser({ redirectTo: "/" })
  const router = useRouter()
  const { showMessage, SnackbarAlert } = useSnackbar()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [state, setState] = useState<AvailablePlansConfig | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const typeQuery = typeof router.query.type === "string" ? router.query.type : ""
  const idQuery = typeof router.query.id === "string" ? router.query.id : ""

  async function load() {
    const data = await fetchJson<{ templates: TemplateRow[] }>("/api/templates")
    setTemplates(data.templates || [])
    return data.templates || []
  }

  useEffect(() => {
    if (!router.isReady) return
    fetchJson<{ templates: TemplateRow[] }>("/api/templates")
      .then(data => {
        const rows = data.templates || []
        setTemplates(rows)
        if (idQuery) {
          const found = rows.find(row => row.id === idQuery)
          if (found) {
            setEditingId(found.id)
            setState(hydratePlanConfig(found))
          }
        }
      })
      .catch(e => setError(apiErrorMessage(e, "Could not load templates")))
  }, [router.isReady, idQuery])

  const visible = useMemo(
    () => (typeQuery ? templates.filter(row => row.strategy === typeQuery) : templates),
    [templates, typeQuery]
  )

  async function startNew(
    strategy: typeof STRATEGIES.ATM_STRADDLE | typeof STRATEGIES.ATM_STRANGLE
  ) {
    setError(null)
    setEditingId(null)
    try {
      const starter = await fetchJson<{ config: Record<string, unknown> }>(
        `/api/strategy-defaults?strategy=${strategy}`
      )
      setState(
        hydratePlanConfig({
          ...blankState(strategy),
          ...starter.config,
          strategy,
          name: "",
          id: undefined,
          instrument: INSTRUMENTS.NIFTY,
          instruments: {
            ...(typeof starter.config.instruments === "object" && starter.config.instruments
              ? starter.config.instruments
              : {}),
            [INSTRUMENTS.NIFTY]: true,
          },
        })
      )
    } catch {
      setState(blankState(strategy))
    }
  }

  async function save(formatted: AvailablePlansConfig | null) {
    if (!state) return
    const config = { ...state, ...(formatted || {}), strategy: state.strategy }
    setError(null)
    try {
      const saved = editingId
        ? await axios.put("/api/templates", { id: editingId, config })
        : await axios.post("/api/templates", { config })
      setEditingId(saved.data.id)
      setState(hydratePlanConfig(saved.data))
      await load()
      showMessage("Template saved. Existing jobs were not changed.")
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save template"))
    }
  }

  async function runNow() {
    if (!state) return
    const yes = window.confirm("Create a job from this form without saving the template?")
    if (!yes) return
    setError(null)
    try {
      const payload = formatFormDataForApi({
        strategy: state.strategy as STRATEGIES,
        data: { ...state, runNow: true },
      })
      await axios.post("/api/trades_day", {
        ...payload,
        instrument: state.instrument,
        strategy: state.strategy,
        runNow: true,
        ...(editingId ? { templateId: editingId, planRef: editingId } : {}),
      })
      showMessage("Job created from this form. The template was not saved.")
      router.push("/desk?tab=today")
    } catch (e) {
      setError(apiErrorMessage(e, "Could not run this template"))
    }
  }

  async function saveStarter() {
    if (!state?.strategy) return
    try {
      await axios.put("/api/strategy-defaults", { strategy: state.strategy, config: state })
      showMessage("Saved as the blank starter for a new template.")
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save starter"))
    }
  }

  const strategy = (state?.strategy || typeQuery || STRATEGIES.ATM_STRADDLE) as STRATEGIES
  const Form = strategy === STRATEGIES.ATM_STRANGLE ? ATMStrangleTradeForm : ATMStraddleTradeForm

  return (
    <Layout>
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center" }}>
        <Typography variant="h5" sx={{ flex: 1 }}>
          Templates
        </Typography>
        <Button onClick={() => startNew(STRATEGIES.ATM_STRADDLE)}>New straddle</Button>
        <Button onClick={() => startNew(STRATEGIES.ATM_STRANGLE)}>New strangle</Button>
        <Button component={Link} href="/plan">
          Schedules
        </Button>
      </Stack>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper sx={{ p: 1, width: { md: 280 }, flexShrink: 0 }}>
          {visible.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 1 }}>
              No templates yet.
            </Typography>
          ) : (
            visible.map(row => (
              <Button
                key={row.id}
                fullWidth
                sx={{ justifyContent: "flex-start" }}
                onClick={() => {
                  setEditingId(row.id)
                  setState(hydratePlanConfig(row))
                }}
              >
                {row.name || "Untitled"} · {row.instrument}
              </Button>
            ))
          )}
        </Paper>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {state ? (
            <>
              <Typography variant="h6">Editing template {state.name || ""}</Typography>
              <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                <Button variant="outlined" onClick={runNow}>
                  Run now
                </Button>
                <Button onClick={saveStarter}>Save as starter</Button>
              </Stack>
              <Form
                strategy={strategy}
                state={state as never}
                embedded
                isRunnable={false}
                onChange={changed =>
                  setState(current => (current ? { ...current, ...changed } : current))
                }
                onSubmit={save}
                onCancel={() => setState(null)}
              />
            </>
          ) : (
            <Paper sx={{ p: 3 }}>
              <Typography>
                Select a template or start a new one. Chase stays on its own page.
              </Typography>
            </Paper>
          )}
        </Box>
      </Stack>
      {SnackbarAlert}
    </Layout>
  )
}
