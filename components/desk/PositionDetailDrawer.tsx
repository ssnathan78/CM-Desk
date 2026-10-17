import { Button, Stack, Typography } from "@mui/material"

import { formatIstDateTime } from "../../lib/format"
import BookBadge from "../figures/BookBadge"
import Figure from "../figures/Figure"
import ActionButton from "../lib/ActionButton"
import RecordDrawer from "../records/RecordDrawer"

export type PositionRow = {
  id: string
  tradingsymbol: string
  strategy?: string | null
  provenance?: string | null
  product?: string | null
  quantity: number
  averageEntryPrice?: string | number | null
  markPrice?: string | number | null
  unrealizedPnl?: string | null
  realizedPnl?: string | null
  status?: string
  updatedAt?: string | null
}

export default function PositionDetailDrawer({
  row,
  onClose,
  onSquareOff,
  onClearPhantom,
}: {
  row: PositionRow | null
  onClose: () => void
  onSquareOff: () => void
  onClearPhantom: () => void
}) {
  if (!row) return null
  const qty = Number(row.quantity)
  const flat = qty === 0
  const open = !flat && row.status === "OPEN"
  const book = String(row.provenance || "PAPER")

  return (
    <RecordDrawer
      open={Boolean(row)}
      title={row.tradingsymbol}
      subtitle={`${row.strategy || "—"} · ${book}`}
      onClose={onClose}
    >
      <Stack spacing={1.5}>
        <Typography variant="body2">
          Book: <BookBadge book={book === "LIVE" || book === "RECONCILED" ? "LIVE" : "PAPER"} />
        </Typography>
        <Typography variant="body2">Qty: {qty}</Typography>
        <Typography variant="body2">
          Avg: <Figure kind="price" value={row.averageEntryPrice} flat={flat} />
        </Typography>
        <Typography variant="body2">
          Mark: <Figure kind="price" value={row.markPrice} />
        </Typography>
        <Typography variant="body2">
          Unrealized: <Figure kind="inr" value={flat ? "0" : row.unrealizedPnl} pnl />
        </Typography>
        <Typography variant="body2">
          Realized (lifetime): <Figure kind="inr" value={row.realizedPnl} pnl />
        </Typography>
        {row.updatedAt ? (
          <Typography variant="caption" color="text.secondary">
            Updated {formatIstDateTime(row.updatedAt)}
          </Typography>
        ) : null}
        {open ? (
          <Stack direction="row" spacing={1} sx={{ pt: 1, flexWrap: "wrap" }}>
            <ActionButton actionVariant="order" size="small" onClick={onSquareOff}>
              Square off {qty}…
            </ActionButton>
            <Button size="small" onClick={onClearPhantom} sx={{ whiteSpace: "nowrap" }}>
              Clear phantom row…
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </RecordDrawer>
  )
}
