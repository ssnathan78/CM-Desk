import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { useState } from "react"

import fetchJson from "../../lib/fetchJson"
import { RISK_STRATEGY_KEYS } from "../../lib/trading/riskEngine"
import type { StrategyGap } from "../../lib/trading/strategyReconcile"

type ManualNeed = {
  row: StrategyGap
  quantity: number
  shortfall: number
  side: "BUY" | "SELL"
}

export default function StrategyReconcile(props: { onChanged: () => Promise<unknown> }) {
  const [strategy, setStrategy] = useState<(typeof RISK_STRATEGY_KEYS)[number]>("MOMENTUM")
  const [rows, setRows] = useState<StrategyGap[] | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [manual, setManual] = useState<ManualNeed | null>(null)
  const [manualDate, setManualDate] = useState("")
  const [manualQty, setManualQty] = useState("")
  const [manualPrice, setManualPrice] = useState("")

  function keyOf(row: StrategyGap) {
    return `${row.exchange}|${row.tradingsymbol}|${row.product}`
  }

  async function compare() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await fetchJson<{ rows: StrategyGap[] }>(
        `/api/desk/reconcile-strategy?strategy=${strategy}`
      )
      setRows(result.rows)
      const next: Record<string, string> = {}
      for (const row of result.rows) next[keyOf(row)] = String(row.difference)
      setQuantities(next)
      setMessage(result.rows.length ? null : "No quantity difference for this strategy.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Compare failed")
    } finally {
      setBusy(false)
    }
  }

  async function accept(
    row: StrategyGap,
    manualBody?: { date: string; quantity: number; price: number }
  ) {
    const requested = Number(quantities[keyOf(row)])
    setBusy(true)
    setMessage(null)
    try {
      const result = await fetchJson<{
        ok?: boolean
        needManual?: boolean
        shortfall?: number
        side?: "BUY" | "SELL"
        rows?: StrategyGap[]
      }>("/api/desk/reconcile-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          exchange: row.exchange,
          tradingsymbol: row.tradingsymbol,
          product: row.product,
          quantity: requested,
          manual: manualBody,
        }),
      })
      if (result.needManual) {
        setManual({
          row,
          quantity: requested,
          shortfall: result.shortfall ?? Math.abs(requested),
          side: result.side ?? (requested > 0 ? "BUY" : "SELL"),
        })
        setManualQty(String(result.shortfall ?? Math.abs(requested)))
        setManualDate("")
        setManualPrice("")
        return
      }
      setManual(null)
      setRows(result.rows ?? [])
      await props.onChanged()
      setMessage(`${row.tradingsymbol} updated.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Accept failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <Typography variant="subtitle2">Attribute broker quantity</Typography>
      <Typography variant="body2" color="text.secondary">
        Compares Kite with this strategy after subtracting every other strategy. A positive number
        is shares to add. A negative number is shares to remove. Accept writes only this strategy.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          select
          size="small"
          label="Strategy"
          value={strategy}
          onChange={e => setStrategy(e.target.value as (typeof RISK_STRATEGY_KEYS)[number])}
          sx={{ minWidth: 200 }}
        >
          {RISK_STRATEGY_KEYS.map(key => (
            <MenuItem key={key} value={key}>
              {key}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" disabled={busy} onClick={() => void compare()}>
          Compare
        </Button>
      </Stack>
      {message ? <Typography variant="body2">{message}</Typography> : null}
      {rows && rows.length > 0 ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Symbol</TableCell>
              <TableCell>Broker</TableCell>
              <TableCell>This strategy</TableCell>
              <TableCell>Others</TableCell>
              <TableCell>Difference</TableCell>
              <TableCell>Accept</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => (
              <TableRow key={keyOf(row)}>
                <TableCell>
                  {row.tradingsymbol}
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {row.exchange} {row.product}
                  </Typography>
                </TableCell>
                <TableCell>{row.brokerQty}</TableCell>
                <TableCell>{row.strategyQty}</TableCell>
                <TableCell>{row.otherQty}</TableCell>
                <TableCell>{row.difference}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      value={quantities[keyOf(row)] ?? ""}
                      onChange={e =>
                        setQuantities(current => ({ ...current, [keyOf(row)]: e.target.value }))
                      }
                      sx={{ width: 90 }}
                    />
                    <Button size="small" disabled={busy} onClick={() => void accept(row)}>
                      Accept
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <Dialog open={manual != null} onClose={() => setManual(null)}>
        <DialogTitle>Trade not in today's Kite book</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {manual
              ? `${manual.side} ${manual.row.tradingsymbol}. ${manual.shortfall} shares have no trade to copy. Enter the date, quantity, and price.`
              : ""}
          </Typography>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField
              label="Date"
              type="date"
              value={manualDate}
              onChange={e => setManualDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
            <TextField
              label="Quantity"
              value={manualQty}
              onChange={e => setManualQty(e.target.value)}
              required
            />
            <TextField
              label="Price"
              value={manualPrice}
              onChange={e => setManualPrice(e.target.value)}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManual(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || !manual}
            onClick={() => {
              if (!manual) return
              void accept(manual.row, {
                date: manualDate,
                quantity: Number(manualQty),
                price: Number(manualPrice),
              })
            }}
          >
            Book trade
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
