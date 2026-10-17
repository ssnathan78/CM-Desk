import {
  Alert,
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import axios from "axios"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import FormShell, { FooterMessage } from "../components/forms/FormShell"
import Layout from "../components/Layout"
import ConfirmAction from "../components/lib/ConfirmAction"
import PageSection from "../components/lib/PageSection"
import { useSnackbar } from "../components/lib/useSnackbar"
import TemplateList, { type TemplateRow } from "../components/templates/TemplateList"
import TemplateSummary from "../components/templates/TemplateSummary"
import ATMStraddleTradeForm from "../components/trades/atmStraddle/TradeSetupForm"
import ATMStrangleTradeForm from "../components/trades/atmStrangle/TradeSetupForm"
import { apiErrorMessage } from "../lib/apiClientError"
import { formatFormDataForApi, getSchedulingStateProps } from "../lib/browserUtils"
import { INSTRUMENTS, STRATEGIES, STRATEGIES_DETAILS } from "../lib/constants"
import fetchJson from "../lib/fetchJson"
import { firstTemplateTradeFormError } from "../lib/forms/templateTradeFormSchema"
import { hydratePlanConfig } from "../lib/planClient"
import useUser from "../lib/useUser"
import type { AvailablePlansConfig } from "../types/plans"

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
  const { showMessage } = useSnackbar()
  const [templates, setTemplates] = useState<
    (AvailablePlansConfig & { id: string; schedules?: { dayOfWeek: string }[] })[]
  >([])
  const [state, setState] = useState<AvailablePlansConfig | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRunNow, setConfirmRunNow] = useState(false)
  const [confirmSaveStarter, setConfirmSaveStarter] = useState(false)
  const [confirmResetStarter, setConfirmResetStarter] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const typeQuery = typeof router.query.type === "string" ? router.query.type : ""
  const idQuery = typeof router.query.id === "string" ? router.query.id : ""

  async function load() {
    const data = await fetchJson<{
      templates: (AvailablePlansConfig & { id: string })[]
      schedules: { templateId: string; dayOfWeek: string }[]
    }>("/api/templates")
    const joined = (data.templates || []).map(row => ({
      ...row,
      schedules: (data.schedules || []).filter(s => s.templateId === row.id),
    }))
    setTemplates(
      joined as (AvailablePlansConfig & { id: string; schedules?: { dayOfWeek: string }[] })[]
    )
    return joined
  }

  useEffect(() => {
    if (!router.isReady) return
    fetchJson<{
      templates: AvailablePlansConfig & { id: string }[]
      schedules: { templateId: string; dayOfWeek: string }[]
    }>("/api/templates")
      .then(data => {
        const rows = (data.templates || []).map(row => ({
          ...row,
          schedules: (data.schedules || []).filter(s => s.templateId === row.id),
        }))
        setTemplates(
          rows as unknown as (AvailablePlansConfig & {
            id: string
            schedules?: { dayOfWeek: string }[]
          })[]
        )
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

  function loadTemplate(
    full: AvailablePlansConfig & { id: string; schedules?: { dayOfWeek: string }[] }
  ) {
    setError(null)
    setEditingId(full.id)
    setState(hydratePlanConfig(full))
    setDirty(false)
    void router.replace(
      { pathname: "/templates", query: { ...router.query, id: full.id } },
      undefined,
      {
        shallow: true,
      }
    )
  }

  function withDirtyGuard(action: () => void) {
    if (dirty) {
      setPendingAction(() => action)
      setDiscardOpen(true)
      return
    }
    action()
  }

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
    setDirty(false)
  }

  async function save(formatted: AvailablePlansConfig | null) {
    if (!state) return
    const formErr = firstTemplateTradeFormError(state)
    if (formErr) {
      setError(formErr)
      return
    }
    const config = { ...state, ...(formatted || {}), strategy: state.strategy }
    setError(null)
    try {
      const saved = editingId
        ? await axios.put("/api/templates", { id: editingId, config })
        : await axios.post("/api/templates", { config })
      setEditingId(saved.data.id)
      setState(hydratePlanConfig(saved.data))
      setDirty(false)
      await load()
      showMessage("Template saved. Existing jobs were not changed.")
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save template"))
    }
  }

  function runNow() {
    if (!state) return
    setConfirmRunNow(true)
  }

  async function runNowConfirmed() {
    if (!state) return
    setConfirmRunNow(false)
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
      router.push("/desk?view=now&tab=today")
    } catch (e) {
      setError(apiErrorMessage(e, "Could not run this template"))
    }
  }

  function saveStarter() {
    if (!state?.strategy) return
    setConfirmSaveStarter(true)
  }

  async function saveStarterConfirmed() {
    if (!state?.strategy) return
    setConfirmSaveStarter(false)
    try {
      await axios.put("/api/strategy-defaults", { strategy: state.strategy, config: state })
      showMessage("Saved as the blank starter for a new template.")
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save starter"))
    }
  }

  function resetStarter() {
    if (!state?.strategy) return
    setConfirmResetStarter(true)
  }

  async function resetStarterConfirmed() {
    if (!state?.strategy) return
    setConfirmResetStarter(false)
    setError(null)
    try {
      await axios.delete("/api/strategy-defaults", { data: { strategy: state.strategy } })
      showMessage("Starter reset. The next new template uses the built-in form.")
      if (!editingId) {
        setState(
          blankState(
            state.strategy as typeof STRATEGIES.ATM_STRADDLE | typeof STRATEGIES.ATM_STRANGLE
          )
        )
      }
    } catch (e) {
      setError(apiErrorMessage(e, "Could not reset starter"))
    }
  }

  const strategy = (state?.strategy || typeQuery || STRATEGIES.ATM_STRADDLE) as STRATEGIES
  const Form = strategy === STRATEGIES.ATM_STRANGLE ? ATMStrangleTradeForm : ATMStraddleTradeForm

  return (
    <Layout title="Templates" maxWidth="xl">
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 1, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}
      >
        <Button onClick={() => withDirtyGuard(() => void startNew(STRATEGIES.ATM_STRADDLE))}>
          New straddle
        </Button>
        <Button onClick={() => withDirtyGuard(() => void startNew(STRATEGIES.ATM_STRANGLE))}>
          New strangle
        </Button>
        <Button component={Link} href="/plan">
          Schedules
        </Button>
      </Stack>
      {error && !state ? (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={typeQuery || "ALL"}
        onChange={(_, v) => {
          if (!v) return
          const q = v === "ALL" ? {} : { type: v }
          withDirtyGuard(() => {
            router.replace({ pathname: "/templates", query: q }, undefined, { shallow: true })
          })
        }}
        sx={{ mb: 1 }}
      >
        <ToggleButton value="ALL">All</ToggleButton>
        <ToggleButton value={STRATEGIES.ATM_STRADDLE}>Straddle</ToggleButton>
        <ToggleButton value={STRATEGIES.ATM_STRANGLE}>Strangle</ToggleButton>
      </ToggleButtonGroup>
      <PageSection
        title="Template library"
        description="List on the left; editor on the right. Chase is configured on its own page."
        flush
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            minHeight: 480,
            px: 2,
            pb: 2,
          }}
        >
          <TemplateList
            rows={visible}
            selectedId={editingId}
            onSelect={row => {
              const full = templates.find(t => t.id === row.id)
              if (!full) return
              withDirtyGuard(() => loadTemplate(full))
            }}
          />
          {state ? (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                {editingId ? `Editing ${state.name || "template"}` : "New template"}
              </Typography>
              <TemplateSummary state={state as unknown as Record<string, unknown>} />
              <FormShell
                footerLeft={error ? <FooterMessage tone="danger">{error}</FooterMessage> : null}
                runNow={() => setConfirmRunNow(true)}
                onCancel={() => {
                  setError(null)
                  setState(null)
                  setEditingId(null)
                }}
                onSave={() => void save(null)}
                saveLabel="Save template"
              >
                <Form
                  strategy={strategy}
                  state={state as never}
                  embedded
                  notice={error}
                  isRunnable={false}
                  onChange={changed => {
                    setDirty(true)
                    setState(current => (current ? { ...current, ...changed } : current))
                  }}
                  onSubmit={save}
                  onCancel={() => {
                    setError(null)
                    setState(null)
                  }}
                />
              </FormShell>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={saveStarter}>
                  Save as starter…
                </Button>
                <Button size="small" onClick={resetStarter}>
                  Reset starter…
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box sx={{ p: 3, flex: 1 }}>
              <Typography>Select a template or start a new one.</Typography>
            </Box>
          )}
        </Box>
      </PageSection>
      <ConfirmAction
        open={confirmRunNow}
        title="Run without saving?"
        message="Create a job from this form without saving the template?"
        confirmLabel="Create job"
        onCancel={() => setConfirmRunNow(false)}
        onConfirm={() => runNowConfirmed()}
      />
      <ConfirmAction
        open={confirmSaveStarter}
        title="Save starter form?"
        message="Replace the blank form used by the next new template of this type? Templates you already saved stay as they are."
        confirmLabel="Save starter"
        onCancel={() => setConfirmSaveStarter(false)}
        onConfirm={() => saveStarterConfirmed()}
      />
      <ConfirmAction
        open={discardOpen}
        title="Discard unsaved changes?"
        message="This template has edits that are not saved."
        confirmLabel="Discard"
        onCancel={() => {
          setDiscardOpen(false)
          setPendingAction(null)
        }}
        onConfirm={() => {
          setDiscardOpen(false)
          setDirty(false)
          const run = pendingAction
          setPendingAction(null)
          run?.()
        }}
      />
      <ConfirmAction
        open={confirmResetStarter}
        title="Reset starter form?"
        message="Put the blank form back to the built-in one? Templates you already saved stay as they are."
        confirmLabel="Reset starter"
        onCancel={() => setConfirmResetStarter(false)}
        onConfirm={() => resetStarterConfirmed()}
      />
    </Layout>
  )
}
