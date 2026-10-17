import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  Stack,
  Typography,
} from "@mui/material"

type OrderLine = { symbol: string; side: string; quantity: number; reason: string }

export default function MomentumPlannedOrdersPanel({
  orders,
  lastDataPullOn,
  computedAt,
  due,
  previewDiffSummary,
}: {
  orders: OrderLine[]
  lastDataPullOn: string | null
  computedAt: string | null
  due: boolean
  previewDiffSummary?: string | null
}) {
  const rankLabel = computedAt
    ? new Date(computedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "not stored"

  return (
    <Stack spacing={1} sx={{ mb: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Chip size="small" label={`${orders.length} planned`} variant="outlined" />
        <Typography variant="body2" color="text.secondary">
          Last pull {lastDataPullOn ?? "never"} · Rank as of {rankLabel} · Rebalance day{" "}
          {due ? "yes" : "no"}
        </Typography>
        {previewDiffSummary ? (
          <Chip size="small" color="info" variant="outlined" label={`Preview diff: ${previewDiffSummary}`} />
        ) : null}
      </Stack>
      {orders.length > 0 ? (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            bgcolor: "action.hover",
            borderRadius: 1,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
            <Typography variant="body2">
              Planned orders ({orders.length}) — preview / last rebalance diff
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack component="ul" sx={{ m: 0, pl: 2.5, gap: 0.5 }}>
              {orders.map(order => (
                <Typography component="li" key={`${order.side}-${order.symbol}`} variant="body2">
                  <strong>{order.side}</strong> {order.symbol} {order.quantity} — {order.reason}
                </Typography>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No planned buys or sells in the stored list. Use Preview orders on Run &amp; filters to
          refresh.
        </Typography>
      )}
    </Stack>
  )
}
