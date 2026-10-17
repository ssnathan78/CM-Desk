import { Box, Button, Stack, TextField, Typography } from "@mui/material"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import ChaseBookDrawer from "../components/chase/ChaseBookDrawer"
import ChaseBooksTable from "../components/chase/ChaseBooksTable"
import Layout from "../components/Layout"
import { useActionNotice } from "../components/lib/ActionNotice"
import ConfirmAction from "../components/lib/ConfirmAction"
import { ChaseNotionalPreview } from "../components/lib/NotionalPreview"
import PageSection from "../components/lib/PageSection"
import StrategyTablePagination from "../components/lib/StrategyTablePagination"
import TableColumnMenu from "../components/lib/TableColumnMenu"
import { useSnackbar } from "../components/lib/useSnackbar"
import {
  CHASE_BOOK_COLUMNS,
  CHASE_VISIBLE_COLUMNS_KEY,
  type ChaseTableColumnId,
} from "../lib/chase/chaseTableColumns"
import { CHASE_INDEX_ORDER, type ChaseBookConfig, defaultChaseBook } from "../lib/chaseDefaults"
import fetchJson, { type FetchJsonError } from "../lib/fetchJson"
import { type FlattenOpenResult, flattenOperatorNotice } from "../lib/flattenNotice"
import { useChaseSettings } from "../lib/hooks/useChaseSettings"
import { useDeskStatus } from "../lib/hooks/useDeskStatus"
import { type ActionOutcome, chaseSquareOffCopy } from "../lib/operatorActionCopy"
import { SQUARE_OFF_CONFIRM } from "../lib/operatorConfirm"
import {
  defaultVisibleIds,
  readVisibleColumns,
  writeVisibleColumns,
} from "../lib/ui/columnVisibility"
import { labelFor } from "../lib/ui/labels"
import { paginateSlice } from "../lib/ui/tablePagination"
import useUser from "../lib/useUser"

const ChasePlanPage = () => {
  useUser({ redirectTo: "/" })
  const { data: deskStatus } = useDeskStatus()
  const { data, error, mutate } = useChaseSettings()
  const [books, setBooks] = useState<ChaseBookConfig[]>(
    CHASE_INDEX_ORDER.map(instrument => defaultChaseBook(instrument, instrument === "NIFTY"))
  )
  const { showNotice: showSearchNotice, NoticeBanner: searchNotice } = useActionNotice()
  const { showMessage } = useSnackbar()
  const bookToast = (instrument: string, text: string, severity: "success" | "error" | "info") => {
    showMessage(`${labelFor(instrument)}: ${text}`, severity)
  }
  const [resetInstrument, setResetInstrument] = useState<string | null>(null)
  const [flattenTarget, setFlattenTarget] = useState<string | "ALL" | null>(null)
  const [flattenOutcome, setFlattenOutcome] = useState<ActionOutcome | null>(null)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<string[]>([])
  const [editInstrument, setEditInstrument] = useState<string | null>(null)
  const [drawerSaving, setDrawerSaving] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<ChaseTableColumnId[]>(() =>
    defaultVisibleIds(CHASE_BOOK_COLUMNS)
  )
  const [tablePage, setTablePage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  useEffect(() => {
    setVisibleColumns(readVisibleColumns(CHASE_VISIBLE_COLUMNS_KEY, CHASE_BOOK_COLUMNS))
  }, [])

  useEffect(() => {
    if (data?.books?.length) {
      setBooks(data.books)
    }
  }, [data])

  const pageBooks = useMemo(
    () => paginateSlice(books, tablePage, rowsPerPage),
    [books, tablePage, rowsPerPage]
  )

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
      bookToast(instrument, `${verb}.`, "success")
      await mutate()
      return true
    } catch (e) {
      const err = e as FetchJsonError
      bookToast(
        instrument,
        (err.data as { error?: string })?.error || err.message || "Could not save.",
        "error"
      )
      return false
    }
  }

  const squareOffChase = async () => {
    const instrument = flattenTarget === "ALL" ? null : flattenTarget
    try {
      const result = await fetchJson<FlattenOpenResult>("/api/desk/flatten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          instrument
            ? { strategy: "CHASE", instrument, confirm: SQUARE_OFF_CONFIRM }
            : { strategy: "CHASE", confirm: SQUARE_OFF_CONFIRM }
        ),
      })
      const notice = flattenOperatorNotice(
        result,
        instrument
          ? `${instrument} squared off. Other Chase books stay. The next hourly job can take a fresh signal on this book.`
          : "Every Chase book was squared off. The next hourly job can take a fresh signal."
      )
      setFlattenOutcome(notice)
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      setFlattenOutcome({
        severity: "error",
        text:
          (err.data as { error?: string })?.error || err.message || "Could not square off Chase.",
      })
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
      bookToast(
        instrument,
        "Reset to AWAITING_SIGNAL. The next hourly job can take a fresh signal.",
        "success"
      )
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      bookToast(
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
      bookToast(instrument, "Added. Trade this book is off until you turn it on.", "success")
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
      bookToast(
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
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="body2" color="text.secondary">
              Futures trend-follow on hourly EMA. Overnight allowed. Rolls front month 15:00 IST on
              expiry.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {chaseDesk
                ? `Desk: ${chaseDesk.enabled ? "Enabled" : "Disabled — dark"} · Book: ${executionMode} · New entries: ${chaseDesk.halted ? "paused" : "allowed"}`
                : null}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button component={Link} href="/help/chase" size="small">
              Guide
            </Button>
            <Button
              color="warning"
              variant="outlined"
              onClick={() => {
                setFlattenOutcome(null)
                setFlattenTarget("ALL")
              }}
            >
              Square off all Chase books…
            </Button>
          </Stack>
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
          description="Book column stays fixed while you scroll. Choose columns from the header menu. Row click or ⋮ → Edit opens the drawer."
          flush
          actions={
            <TableColumnMenu
              columns={CHASE_BOOK_COLUMNS}
              visible={visibleColumns}
              onChange={cols => {
                setVisibleColumns(cols)
                writeVisibleColumns(CHASE_VISIBLE_COLUMNS_KEY, cols)
              }}
            />
          }
        >
          <ChaseBooksTable
            books={pageBooks}
            statuses={data.statuses ?? []}
            executionMode={executionMode}
            visibleColumns={visibleColumns}
            onRowClick={instrument => setEditInstrument(instrument)}
            onEngineChange={(instrument, enabled) => void saveBook(instrument, { enabled })}
            onPauseChange={(instrument, paused) => void saveBook(instrument, { paused })}
            onMenuAction={(instrument, action) => {
              if (action === "edit") setEditInstrument(instrument)
              if (action === "reset") setResetInstrument(instrument)
              if (action === "remove") setRemoveTarget(instrument)
              if (action === "square") {
                setFlattenOutcome(null)
                setFlattenTarget(instrument)
              }
            }}
          />
          <StrategyTablePagination
            count={books.length}
            page={tablePage}
            rowsPerPage={rowsPerPage}
            onPageChange={setTablePage}
            onRowsPerPageChange={setRowsPerPage}
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
              const saved = await saveBook(editInstrument, patch)
              if (saved) setEditInstrument(null)
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
          open={flattenTarget !== null}
          tone="attention"
          title={chaseSquareOffCopy(flattenTarget === "ALL" ? null : flattenTarget).title}
          message={chaseSquareOffCopy(flattenTarget === "ALL" ? null : flattenTarget).message}
          confirmLabel="Square off"
          outcome={flattenOutcome}
          onConfirm={() => void squareOffChase()}
          onCancel={() => {
            setFlattenTarget(null)
            setFlattenOutcome(null)
          }}
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
