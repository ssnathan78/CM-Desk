import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
  defaultChaseBook,
  type ChaseBookConfig,
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
      setStatus(`${instrument} reset to AWAITING_SIGNAL. The next hourly job can take a fresh signal.`)
      await mutate()
    } catch (e) {
      const err = e as FetchJsonError
      setStatus(
        (err.data as { error?: string })?.error || err.message || "Could not reset Chase status."
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
    <Layout title="Chase plan" maxWidth="md">
      <Typography variant="h5" component="h1">
        Chase
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        Futures trend-follow around a long EMA. Each index is its own Chase book — lots, buffer,
        pause, and 09:16 classify are independent. This is not a weekday template.
      </Typography>
      <Button component={Link} href="/help/chase" size="small" sx={{ mb: 2 }}>
        Chase guide
      </Button>

      <Stack spacing={2} sx={{ mb: 2 }}>
        {books.map(book => (
          <Paper key={book.instrument} sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center", flexWrap: "wrap" }}>
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
                label="Trade this index"
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
                <MenuItem value={CHASE_OPEN_CLASSIFY.PDF_0916}>PDF — 09:16 candle (default)</MenuItem>
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
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Button color="warning" variant="contained" onClick={() => setFlattenOpen(true)} sx={{ mb: 2 }}>
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
        open={Boolean(resetInstrument)}
        title={`Reset ${resetInstrument || "Chase"} to a fresh signal?`}
        message="This sets that index back to AWAITING_SIGNAL and cancels a pending entry trigger. It does not flatten an open futures position. Use Square off when you want out of the current book."
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
