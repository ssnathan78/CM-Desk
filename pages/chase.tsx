import {
  Alert,
  Button,
  Chip,
  Drawer,
  FormControlLabel,
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
import ConfirmDialog from "../components/lib/ConfirmDialog"
import { ChaseNotionalPreview } from "../components/lib/NotionalPreview"
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

const ChasePlanPage = () => {
  useUser({ redirectTo: "/" })
  const { data, error, mutate } = useChaseSettings()
  const [books, setBooks] = useState<ChaseBookConfig[]>(
    CHASE_INDEX_ORDER.map(instrument => defaultChaseBook(instrument, instrument === "NIFTY"))
  )
  const [status, setStatus] = useState("")
  const [resetInstrument, setResetInstrument] = useState<string | null>(null)
  const [flattenOpen, setFlattenOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<string[]>([])

  useEffect(() => {
    if (data?.books?.length) {
      setBooks(data.books)
    }
  }, [data])

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
      setStatus(`Saved ${instrument}.`)
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      setStatus((err.data as { error?: string })?.error || err.message || "Could not save.")
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
      setStatus("Chase squared off. The next hourly job can take a fresh signal.")
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      setStatus(
        (err.data as { error?: string })?.error || err.message || "Could not square off Chase."
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
      setStatus(
        `${instrument} reset to AWAITING_SIGNAL. The next hourly job can take a fresh signal.`
      )
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      setStatus(
        (err.data as { error?: string })?.error || err.message || "Could not reset Chase status."
      )
    }
  }

  const searchUnderlyings = async () => {
    try {
      const found = await fetchJson<{ names: string[] }>(
        `/api/chase-underlyings?q=${encodeURIComponent(query)}`
      )
      setMatches(found.names ?? [])
      setStatus(found.names?.length ? "" : "No matching unexpired NFO future.")
    } catch (e) {
      const err = e as FetchJsonError
      setStatus(
        (err.data as { error?: string })?.error || err.message || "Could not search futures."
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
      setSelected(instrument)
      setStatus(`${instrument} added. Trade this book is off until you turn it on.`)
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      setStatus((err.data as { error?: string })?.error || err.message || "Could not add.")
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
      if (selected === instrument) setSelected(null)
      setStatus(`${instrument} removed.`)
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      setStatus((err.data as { error?: string })?.error || err.message || "Could not remove.")
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
    <Layout title="Chase plan" maxWidth="md">
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

      <Paper sx={{ overflow: "hidden", mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Underlying</TableCell>
              <TableCell>Trade</TableCell>
              <TableCell>Entries</TableCell>
              <TableCell align="right">Lots</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {books.map(book => (
              <TableRow
                key={book.instrument}
                hover
                selected={selected === book.instrument}
                onClick={() => setSelected(book.instrument)}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>{book.instrument}</TableCell>
                <TableCell>{book.enabled ? "On" : "Off"}</TableCell>
                <TableCell>{!book.enabled ? "—" : book.paused ? "Paused" : "Allowed"}</TableCell>
                <TableCell align="right">{book.lots}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A book that is off and flat does not load candles or write signals. The minute job still
        trails a book that is already open. Search uses the cached NFO futures list.
      </Typography>

      <Drawer
        anchor="right"
        open={books.some(book => book.instrument === selected)}
        onClose={() => setSelected(null)}
      >
        {books
          .filter(book => book.instrument === selected)
          .map(book => (
            <Paper key={book.instrument} sx={{ p: 2.5, width: { xs: "100vw", sm: 440 } }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mb: 2, alignItems: "center", flexWrap: "wrap" }}
              >
                <Typography variant="h6">{book.instrument}</Typography>
                <Chip
                  size="small"
                  color={!book.enabled ? "default" : book.paused ? "warning" : "success"}
                  label={
                    !book.enabled
                      ? "Off"
                      : book.paused
                        ? "Paused — no new entries"
                        : "Live — new entries allowed"
                  }
                />
              </Stack>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={book.enabled}
                      onChange={e =>
                        setBooks(current =>
                          current.map(row =>
                            row.instrument === book.instrument
                              ? { ...row, enabled: e.target.checked }
                              : row
                          )
                        )
                      }
                    />
                  }
                  label={
                    <span>
                      Trade this book{" "}
                      <Typography component="span" variant="body2" color="text.secondary">
                        (hourly candles and signals; an open book still gets the minute stop)
                      </Typography>
                    </span>
                  }
                />
                <TextField
                  label="Lots"
                  type="number"
                  size="small"
                  fullWidth
                  value={book.lots}
                  onChange={e =>
                    setBooks(current =>
                      current.map(row =>
                        row.instrument === book.instrument
                          ? { ...row, lots: Number(e.target.value) }
                          : row
                      )
                    )
                  }
                />
                <ChaseNotionalPreview
                  lots={book.lots}
                  instruments={[book.instrument]}
                  maxNotionalInr={data.notional?.maxNotionalInr ?? 0}
                  priceByIndex={Object.fromEntries(
                    (data.notional?.rows ?? []).map(row => [row.instrument, row.price])
                  )}
                />
                <TextField
                  label="EMA period"
                  type="number"
                  size="small"
                  fullWidth
                  value={book.emaPeriod}
                  onChange={e =>
                    setBooks(current =>
                      current.map(row =>
                        row.instrument === book.instrument
                          ? { ...row, emaPeriod: Number(e.target.value) }
                          : row
                      )
                    )
                  }
                />
                <TextField
                  label="Buffer %"
                  type="number"
                  size="small"
                  fullWidth
                  value={book.bufferPercent}
                  onChange={e =>
                    setBooks(current =>
                      current.map(row =>
                        row.instrument === book.instrument
                          ? { ...row, bufferPercent: Number(e.target.value) }
                          : row
                      )
                    )
                  }
                />
                <TextField
                  label="Market protection %"
                  type="number"
                  size="small"
                  fullWidth
                  value={book.marketProtectionPercent}
                  slotProps={{ htmlInput: { step: 0.05, min: 0.25, max: 5 } }}
                  onChange={e =>
                    setBooks(current =>
                      current.map(row =>
                        row.instrument === book.instrument
                          ? { ...row, marketProtectionPercent: Number(e.target.value) }
                          : row
                      )
                    )
                  }
                  helperText="Chase market orders become a limit this percent away from the last price. 1.5% stays inside the exchange band."
                />
                <TextField
                  label="Entry limit offset"
                  type="number"
                  size="small"
                  fullWidth
                  value={book.entryLimitOffset}
                  onChange={e =>
                    setBooks(current =>
                      current.map(row =>
                        row.instrument === book.instrument
                          ? { ...row, entryLimitOffset: Number(e.target.value) }
                          : row
                      )
                    )
                  }
                />
                <TextField
                  select
                  label="09:16 morning classify"
                  size="small"
                  fullWidth
                  value={book.openClassify}
                  onChange={e =>
                    setBooks(current =>
                      current.map(row =>
                        row.instrument === book.instrument
                          ? { ...row, openClassify: normalizeChaseOpenClassify(e.target.value) }
                          : row
                      )
                    )
                  }
                  helperText="PDF uses the 09:16 candle close vs overnight hourly EMA. Legacy steps 40-EMA on a 60-minute bar."
                >
                  <MenuItem value={CHASE_OPEN_CLASSIFY.PDF_0916}>
                    PDF — 09:16 candle (default)
                  </MenuItem>
                  <MenuItem value={CHASE_OPEN_CLASSIFY.LEGACY_60M}>Legacy — 60-minute bar</MenuItem>
                </TextField>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                <Button variant="contained" onClick={() => saveBook(book.instrument)}>
                  Save {book.instrument}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => saveBook(book.instrument, { paused: !book.paused })}
                  disabled={!book.enabled}
                  title="Blocks new entries on this book only. An open position still trails until flat. Does not flatten or halt."
                >
                  {book.paused ? "Resume entries" : "Pause entries"}
                </Button>
                <Button
                  color="warning"
                  variant="outlined"
                  onClick={() => setResetInstrument(book.instrument)}
                >
                  Reset signal
                </Button>
                <Button
                  color="warning"
                  variant="text"
                  onClick={() => setRemoveTarget(book.instrument)}
                >
                  Remove
                </Button>
              </Stack>
            </Paper>
          ))}
      </Drawer>

      <Button
        color="warning"
        variant="contained"
        onClick={() => setFlattenOpen(true)}
        sx={{ mb: 2 }}
      >
        Square off all Chase books
      </Button>

      {status ? (
        <Alert
          severity={
            status.startsWith("Could") || status.includes("open book") ? "error" : "success"
          }
        >
          {status}
        </Alert>
      ) : null}

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
