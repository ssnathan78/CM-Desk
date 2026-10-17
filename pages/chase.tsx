import { Box, Button, Stack, TextField, Typography, useMediaQuery } from "@mui/material"
import { useTheme } from "@mui/material/styles"
import Link from "next/link"
import { useEffect, useState } from "react"
import ChaseBookDrawer from "../components/chase/ChaseBookDrawer"
import ChaseBooksTable from "../components/chase/ChaseBooksTable"
import Layout from "../components/Layout"
import { useActionNotice, useRowNotices } from "../components/lib/ActionNotice"
import ConfirmAction from "../components/lib/ConfirmAction"
import { ChaseNotionalPreview } from "../components/lib/NotionalPreview"
import PageSection from "../components/lib/PageSection"
import { useSnackbar } from "../components/lib/useSnackbar"
import { CHASE_INDEX_ORDER, type ChaseBookConfig, defaultChaseBook } from "../lib/chaseDefaults"
import fetchJson, { type FetchJsonError } from "../lib/fetchJson"
import { type FlattenOpenResult, flattenOperatorNotice } from "../lib/flattenNotice"
import { useChaseSettings } from "../lib/hooks/useChaseSettings"
import { useDeskStatus } from "../lib/hooks/useDeskStatus"
import useUser from "../lib/useUser"

const ChasePlanPage = () => {
  useUser({ redirectTo: "/" })
  const theme = useTheme()
  const showPriceCols = useMediaQuery(theme.breakpoints.up("lg"))
  const { data: deskStatus } = useDeskStatus()
  const { data, error, mutate } = useChaseSettings()
  const [books, setBooks] = useState<ChaseBookConfig[]>(
    CHASE_INDEX_ORDER.map(instrument => defaultChaseBook(instrument, instrument === "NIFTY"))
  )
  const { rows: rowNotice, showRow } = useRowNotices()
  const { showNotice: showSearchNotice, NoticeBanner: searchNotice } = useActionNotice()
  const { showMessage } = useSnackbar()
  const [resetInstrument, setResetInstrument] = useState<string | null>(null)
  const [flattenOpen, setFlattenOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<string[]>([])
  const [editInstrument, setEditInstrument] = useState<string | null>(null)
  const [drawerSaving, setDrawerSaving] = useState(false)

  useEffect(() => {
    if (data?.books?.length) {
      setBooks(data.books)
    }
  }, [data])

  const patchBook = (instrument: string, patch: Partial<ChaseBookConfig>) => {
    setBooks(current =>
      current.map(row => (row.instrument === instrument ? { ...row, ...patch } : row))
    )
  }

  const saveBook = async (instrument: string, patch: Partial<ChaseBookConfig> = {}) => {
    const current = books.find(book => book.instrument === instrument)
    const next = { ...current, ...patch, instrument }
    try {
      const saved = await fetchJson<{ books: ChaseBookConfig[] }>("/api/chase-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: next }),
      })
      if (saved.books?.length) setBooks(saved.books)
      const verb = patch.paused === true ? "Paused" : patch.paused === false ? "Resumed" : "Saved"
      showRow(instrument, `${verb} ${instrument}.`, "success")
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      showRow(
        instrument,
        (err.data as { error?: string })?.error || err.message || "Could not save.",
        "error"
      )
    }
  }

  const squareOffChase = async () => {
    setFlattenOpen(false)
    try {
      const result = await fetchJson<FlattenOpenResult>("/api/desk/flatten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: "CHASE" }),
      })
      const notice = flattenOperatorNotice(
        result,
        "Chase squared off. The next hourly job can take a fresh signal."
      )
      showMessage(notice.text, notice.severity)
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      showMessage(
        (err.data as { error?: string })?.error || err.message || "Could not square off Chase.",
        "error"
      )
    }
  }

  const resetSignal = async (instrument: string) => {
    setResetInstrument(null)
    try {
      await fetchJson("/api/chase-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-signal", instrument }),
      })
      showRow(
        instrument,
        `${instrument} reset to AWAITING_SIGNAL. The next hourly job can take a fresh signal.`,
        "success"
      )
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      showRow(
        instrument,
        (err.data as { error?: string })?.error || err.message || "Could not reset Chase status.",
        "error"
      )
    }
  }

  const searchUnderlyings = async () => {
    try {
      const found = await fetchJson<{ names: string[] }>(
        `/api/chase-underlyings?q=${encodeURIComponent(query)}`
      )
      setMatches(found.names ?? [])
      if (!found.names?.length) showSearchNotice("No matching unexpired NFO future.", "info")
    } catch (e) {
      const err = e as FetchJsonError
      showSearchNotice(
        (err.data as { error?: string })?.error || err.message || "Could not search futures.",
        "error"
      )
    }
  }

  const addUnderlying = async (instrument: string) => {
    try {
      const saved = await fetchJson<{ books: ChaseBookConfig[] }>("/api/chase-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-underlying", instrument }),
      })
      if (saved.books?.length) setBooks(saved.books)
      setMatches(current => current.filter(name => name !== instrument))
      showRow(instrument, "Added. Trade this book is off until you turn it on.", "success")
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      showSearchNotice(
        (err.data as { error?: string })?.error || err.message || "Could not add.",
        "error"
      )
    }
  }

  const removeUnderlying = async (instrument: string) => {
    setRemoveTarget(null)
    try {
      const saved = await fetchJson<{ books: ChaseBookConfig[] }>("/api/chase-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-underlying", instrument }),
      })
      if (saved.books) setBooks(saved.books)
      showMessage(`${instrument} removed.`, "success")
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      showRow(
        instrument,
        (err.data as { error?: string })?.error || err.message || "Could not remove.",
        "error"
      )
    }
  }

  if (error) {
    return (
      <Layout title="Chase">
        <Typography color="error">Could not load Chase settings.</Typography>
      </Layout>
    )
  }

  if (!data) {
    return <Layout title="Chase" loading />
  }

  const chaseDesk = deskStatus?.strategies.CHASE
  const executionMode = chaseDesk?.executionMode ?? "PAPER"

  return (
    <Layout title="Chase" maxWidth="xl">
      <Stack spacing={3}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Box sx={{ flex: 1 }}>
            <Typography color="text.secondary">
              Futures trend-follow on hourly EMA. Overnight allowed. Rolls front month 15:00 IST on
              expiry. <Link href="/help/chase">Guide</Link>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {chaseDesk
                ? `Desk: ${chaseDesk.enabled ? "Enabled" : "Disabled — dark"} · Book: ${executionMode} · New entries: ${chaseDesk.halted ? "paused" : "allowed"}`
                : null}
            </Typography>
          </Box>
          <Button color="warning" variant="outlined" onClick={() => setFlattenOpen(true)}>
            Square off all Chase books…
          </Button>
        </Stack>

        <PageSection
          title="Add underlying"
          description="Search NSE cash names, then add a Chase futures book for that symbol."
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              label="Add underlying"
              placeholder="RELIANCE, INFY, NIFTY"
              value={query}
              onChange={e => setQuery(e.target.value)}
              sx={{ minWidth: { sm: 280 } }}
            />
            <Button variant="outlined" onClick={() => void searchUnderlyings()}>
              Search futures
            </Button>
          </Stack>
          {searchNotice}
          {matches.length ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }}>
              {matches.map(name => (
                <Button
                  key={name}
                  size="small"
                  variant="outlined"
                  onClick={() => void addUnderlying(name)}
                >
                  Add {name}
                </Button>
              ))}
            </Stack>
          ) : null}
        </PageSection>

        <PageSection
          title="Books"
          description="Row click or pencil opens the drawer. Engine and pause save immediately."
          flush
        >
          <ChaseBooksTable
            books={books}
            statuses={data.statuses ?? []}
            executionMode={executionMode}
            showPriceCols={showPriceCols}
            rowNotice={rowNotice}
            onRowClick={instrument => setEditInstrument(instrument)}
            onEngineChange={(instrument, enabled) => {
              patchBook(instrument, { enabled })
              void saveBook(instrument, { enabled })
            }}
            onPauseChange={(instrument, paused) => void saveBook(instrument, { paused })}
            onMenuAction={(instrument, action) => {
              if (action === "edit") setEditInstrument(instrument)
              if (action === "reset") setResetInstrument(instrument)
              if (action === "remove") setRemoveTarget(instrument)
              if (action === "square") setFlattenOpen(true)
            }}
          />
        </PageSection>
        <ChaseBookDrawer
          open={Boolean(editInstrument)}
          book={books.find(b => b.instrument === editInstrument) ?? null}
          onClose={() => setEditInstrument(null)}
          saving={drawerSaving}
          onSave={async patch => {
            if (!editInstrument) return
            setDrawerSaving(true)
            try {
              await saveBook(editInstrument, patch)
              setEditInstrument(null)
            } finally {
              setDrawerSaving(false)
            }
          }}
        />
        {books
          .filter(book => book.enabled)
          .map(book => (
            <ChaseNotionalPreview
              key={book.instrument}
              lots={book.lots}
              instruments={[book.instrument]}
              maxNotionalInr={data.notional?.maxNotionalInr ?? 0}
              priceByIndex={Object.fromEntries(
                (data.notional?.rows ?? []).map(row => [row.instrument, row.price])
              )}
              lotSizeByIndex={data.notional?.lotSizes}
            />
          ))}
        <ConfirmAction
          open={flattenOpen}
          tone="attention"
          title="Square off Chase?"
          message="This flattens every Chase futures book and returns Chase to AWAITING_SIGNAL. The next hourly job can still take a new signal. It does not pause Chase or halt the desk. A live book is refused while the market is closed: the position and its stop stay. Paper still flattens."
          confirmLabel="Square off"
          onConfirm={() => void squareOffChase()}
          onCancel={() => setFlattenOpen(false)}
        />
        <ConfirmAction
          open={Boolean(removeTarget)}
          tone="attention"
          title={`Remove ${removeTarget || "this book"}?`}
          message="This drops the underlying from Chase. It is refused while the book is open or waiting on an entry. It does not send an order."
          confirmLabel="Remove"
          onConfirm={() => {
            if (removeTarget) void removeUnderlying(removeTarget)
          }}
          onCancel={() => setRemoveTarget(null)}
        />
        <ConfirmAction
          open={Boolean(resetInstrument)}
          tone="attention"
          title={`Reset ${resetInstrument || "Chase"} to a fresh signal?`}
          message="If this book still has futures quantity, Reset is refused and the position stays. On a flat book, or a pending entry that never filled, this returns the signal to AWAITING_SIGNAL and cancels that pending entry. It does not send a flatten. Use Square off when you want out of the current book."
          confirmLabel="Reset signal"
          onConfirm={() => {
            if (resetInstrument) void resetSignal(resetInstrument)
          }}
          onCancel={() => setResetInstrument(null)}
        />
      </Stack>
    </Layout>
  )
}

export default ChasePlanPage
export { getServerSideProps } from "../lib/ssrPage"
