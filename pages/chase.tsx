import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import Link from "next/link"
import { useEffect, useState } from "react"

import Layout from "../components/Layout"
import { useActionNotice, useRowNotices } from "../components/lib/ActionNotice"
import ConfirmDialog from "../components/lib/ConfirmDialog"
import { ChaseNotionalPreview } from "../components/lib/NotionalPreview"
import ScrollTable from "../components/lib/ScrollTable"
import { useSnackbar } from "../components/lib/useSnackbar"
import {
  CHASE_INDEX_ORDER,
  CHASE_OPEN_CLASSIFY,
  type ChaseBookConfig,
  defaultChaseBook,
} from "../lib/chaseDefaults"
import { normalizeChaseOpenClassify } from "../lib/chaseOpenClassify"
import fetchJson, { type FetchJsonError } from "../lib/fetchJson"
import { useChaseSettings } from "../lib/hooks/useChaseSettings"
import useUser from "../lib/useUser"

const CHASE_COLUMN_NOTES = [
  {
    term: "Trade",
    text: "Whether this book is in the hourly engine. Off skips candles and new signals. If it is already LONG, SHORT, or waiting on an entry, the minute job still trails and stops it.",
  },
  {
    term: "Pause / Resume",
    text: "Blocks new entries on this book only. EMA still updates. An open position keeps its stop until flat, then it will not re-enter until you Resume. Pause is disabled while Trade is off. It saves immediately.",
  },
  {
    term: "Lots",
    text: "How many futures lots this book trades. Quantity is lots × the front-month contract’s lot size. Desk max notional and Chase max lots still apply to every Chase book together.",
  },
  {
    term: "EMA",
    text: "Length of the hourly exponential moving average on typical price (high + low + close) / 3. Shipped value is 40. A longer period turns less often.",
  },
  {
    term: "Buffer %",
    text: "The close must be this percent above the EMA for a long, or this percent below for a short. Shipped value is 0.2, which is 1.002× / 0.998× the EMA. A larger buffer means fewer signals.",
  },
  {
    term: "Protect %",
    text: "How far the limit may sit from the last price on a Chase market order. Shipped value is 1.5. Allowed range is 0.25 to 5.",
  },
  {
    term: "Entry offset",
    text: "When the trigger is not yet traded, the limit is the trigger plus this many rupees on a buy, and minus on a sell. Shipped value is 5. This is not the strategy stop.",
  },
  {
    term: "09:16",
    text: "PDF compares the 09:16 candle close with the overnight hourly EMA. Legacy steps the EMA on a 60-minute bar and is only for comparing with the older port.",
  },
  {
    term: "Save / Reset / Remove",
    text: "Save writes the row. Reset returns this book to a fresh signal and does not flatten an open future. Remove drops the underlying and is refused while the book is open. Neither sends an order.",
  },
] as const

const ChasePlanPage = () => {
  useUser({ redirectTo: "/" })
  const { data, error, mutate } = useChaseSettings()
  const [books, setBooks] = useState<ChaseBookConfig[]>(
    CHASE_INDEX_ORDER.map(instrument => defaultChaseBook(instrument, instrument === "NIFTY"))
  )
  const { rows: rowNotice, showRow } = useRowNotices()
  const { showNotice: showSearchNotice, NoticeBanner: searchNotice } = useActionNotice()
  const { showMessage, SnackbarAlert } = useSnackbar()
  const [resetInstrument, setResetInstrument] = useState<string | null>(null)
  const [flattenOpen, setFlattenOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<string[]>([])

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
      await fetchJson("/api/desk/flatten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: "CHASE" }),
      })
      showMessage("Chase squared off. The next hourly job can take a fresh signal.", "success")
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

  return (
    <Layout title="Chase plan" maxWidth="xl">
      {SnackbarAlert}
      <Typography variant="h5" component="h1">
        Chase
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        Futures trend-follow around a long EMA. Each underlying is its own book — an index or a
        stock future. Lots, buffer, Trade this book / Pause entries, and 09:16 classify are
        independent. This is not a weekday template.{" "}
        <Link href="/help/chase#trade-this-index">Trade this book vs Pause</Link>
      </Typography>
      <Button component={Link} href="/help/chase" size="small" sx={{ mb: 2 }}>
        Chase guide
      </Button>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
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
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
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

      <Paper sx={{ mb: 2 }}>
        <ScrollTable minWidth={1180}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Underlying</TableCell>
                <TableCell>Trade</TableCell>
                <TableCell align="right">Lots</TableCell>
                <TableCell align="right">EMA</TableCell>
                <TableCell align="right">Buffer %</TableCell>
                <TableCell
                  align="right"
                  title="Limit distance from the last price on a Chase market order."
                >
                  Protect %
                </TableCell>
                <TableCell align="right">Entry offset</TableCell>
                <TableCell title="PDF uses the 09:16 candle close. Legacy steps the EMA on a 60-minute bar.">
                  09:16
                </TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {books.map(book => (
                <TableRow key={book.instrument}>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">{book.instrument}</Typography>
                      <Chip
                        size="small"
                        color={!book.enabled ? "default" : book.paused ? "warning" : "success"}
                        label={
                          !book.enabled
                            ? "Off"
                            : book.paused
                              ? "Paused — no new entries"
                              : "Entries allowed"
                        }
                      />
                      {rowNotice[book.instrument] ? (
                        <Typography
                          variant="caption"
                          color={
                            rowNotice[book.instrument].severity === "error"
                              ? "error"
                              : "success.main"
                          }
                        >
                          {rowNotice[book.instrument].text}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={book.enabled}
                      onChange={e => patchBook(book.instrument, { enabled: e.target.checked })}
                      slotProps={{ input: { "aria-label": `Trade ${book.instrument}` } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={book.lots}
                      onChange={e => patchBook(book.instrument, { lots: Number(e.target.value) })}
                      sx={{ width: 72 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={book.emaPeriod}
                      onChange={e =>
                        patchBook(book.instrument, { emaPeriod: Number(e.target.value) })
                      }
                      sx={{ width: 72 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={book.bufferPercent}
                      onChange={e =>
                        patchBook(book.instrument, { bufferPercent: Number(e.target.value) })
                      }
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={book.marketProtectionPercent}
                      slotProps={{ htmlInput: { step: 0.05, min: 0.25, max: 5 } }}
                      onChange={e =>
                        patchBook(book.instrument, {
                          marketProtectionPercent: Number(e.target.value),
                        })
                      }
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={book.entryLimitOffset}
                      onChange={e =>
                        patchBook(book.instrument, { entryLimitOffset: Number(e.target.value) })
                      }
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={book.openClassify}
                      onChange={e =>
                        patchBook(book.instrument, {
                          openClassify: normalizeChaseOpenClassify(e.target.value),
                        })
                      }
                      sx={{ width: 150 }}
                    >
                      <MenuItem value={CHASE_OPEN_CLASSIFY.PDF_0916}>PDF 09:16</MenuItem>
                      <MenuItem value={CHASE_OPEN_CLASSIFY.LEGACY_60M}>Legacy 60m</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "middle", width: 196 }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 0.75,
                        width: 188,
                      }}
                    >
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => saveBook(book.instrument)}
                        sx={{ minWidth: 0 }}
                      >
                        Save
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={!book.enabled}
                        title="Blocks new entries on this book only. An open position still trails until flat."
                        onClick={() => saveBook(book.instrument, { paused: !book.paused })}
                        sx={{ minWidth: 0 }}
                      >
                        {book.paused ? "Resume" : "Pause"}
                      </Button>
                      <Button
                        size="small"
                        color="warning"
                        variant="outlined"
                        onClick={() => setResetInstrument(book.instrument)}
                        sx={{ minWidth: 0 }}
                      >
                        Reset
                      </Button>
                      <Button
                        size="small"
                        color="warning"
                        variant="outlined"
                        onClick={() => setRemoveTarget(book.instrument)}
                        sx={{ minWidth: 0 }}
                      >
                        Remove
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollTable>
      </Paper>
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
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          What each column does
        </Typography>
        <Stack spacing={0.75}>
          {CHASE_COLUMN_NOTES.map(note => (
            <Typography key={note.term} variant="body2" color="text.secondary">
              <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
                {note.term}.
              </Box>{" "}
              {note.text}
            </Typography>
          ))}
        </Stack>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
        Edit a cell, then Save that row. A book that is off and flat does not load candles or write
        signals. The minute job still trails a book that is already open.
      </Typography>

      <Button
        color="warning"
        variant="contained"
        onClick={() => setFlattenOpen(true)}
        sx={{ mb: 2 }}
      >
        Square off all Chase books
      </Button>

      <ConfirmDialog
        open={flattenOpen}
        title="Square off Chase?"
        message="This flattens every Chase futures book and returns Chase to AWAITING_SIGNAL. The next hourly job can still take a new signal. It does not pause Chase or halt the desk."
        confirmLabel="Square off"
        confirmColor="warning"
        onConfirm={() => void squareOffChase()}
        onCancel={() => setFlattenOpen(false)}
      />
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={`Remove ${removeTarget || "this book"}?`}
        message="This drops the underlying from Chase. It is refused while the book is open or waiting on an entry. It does not send an order."
        confirmLabel="Remove"
        confirmColor="warning"
        onConfirm={() => removeTarget && void removeUnderlying(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(resetInstrument)}
        title={`Reset ${resetInstrument || "Chase"} to a fresh signal?`}
        message="This sets that book back to AWAITING_SIGNAL and cancels a pending entry trigger. It does not flatten an open futures position. Use Square off when you want out of the current book."
        confirmLabel="Reset signal"
        confirmColor="warning"
        onConfirm={() => resetInstrument && void resetSignal(resetInstrument)}
        onCancel={() => setResetInstrument(null)}
      />
    </Layout>
  )
}

export default ChasePlanPage
export { getServerSideProps } from "../lib/ssrPage"
