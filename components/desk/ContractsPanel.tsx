import {
  Alert,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import type { DeskInstrumentSnapshot } from "../../lib/trading/deskInstruments"
import PageSection from "../lib/PageSection"
import ScrollTable from "../lib/ScrollTable"

function contract(row: { tradingsymbol: string; expiry: string; lotSize: number } | null) {
  if (!row) return "—"
  return `${row.tradingsymbol}  ·  ${row.expiry}  ·  lot ${row.lotSize}`
}

export default function ContractsPanel({ data }: { data: DeskInstrumentSnapshot | undefined }) {
  if (!data) {
    return (
      <Typography sx={{ p: 2 }} color="text.secondary">
        Loading contract book…
      </Typography>
    )
  }

  return (
    <Stack spacing={3}>
      <Alert severity={data.kiteError ? "warning" : "info"}>{data.cacheNote}</Alert>
      {data.kiteError ? (
        <Alert severity="error">Kite instrument dump failed: {data.kiteError}</Alert>
      ) : null}
      <PageSection
        title="Chase engine"
        description="Index futures books from Chase settings; not option legs."
      >
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 1 }}>
          <Chip size="small" label={`Lots ${data.chase.lots}`} />
          <Chip size="small" label={data.chase.paused ? "Paused" : "Running"} />
          <Chip size="small" label={`EMA ${data.chase.emaPeriod}`} />
          <Chip size="small" label={`Buffer ${data.chase.bufferPercent}%`} />
          <Chip size="small" label={`Entry offset ₹${data.chase.entryLimitOffset}`} />
          <Chip size="small" label={`Indexes ${data.chase.instruments.join(", ") || "—"}`} />
        </Stack>
        <Typography color="text.secondary" variant="body2">
          Chase trades index futures, not options. Front-month FUT is used until expiry day; new
          entries then roll to next month so a flat book does not open the dying contract.
        </Typography>
      </PageSection>

      <PageSection
        title={`Index contracts ${data.source === "KITE_NFO" ? "(Kite NFO)" : "(static lots)"}`}
        description="Front/next FUT and option expiries used at punch time."
        flush
      >
        <ScrollTable minWidth={880}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Index</TableCell>
                <TableCell>Chase</TableCell>
                <TableCell>Front FUT</TableCell>
                <TableCell>Next FUT</TableCell>
                <TableCell>Chase entry today</TableCell>
                <TableCell>Option expiries</TableCell>
                <TableCell>Lot / step</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.indexes.map(row => (
                <TableRow key={row.index}>
                  <TableCell>
                    {row.displayName}
                    <Typography variant="caption" component="p" color="text.secondary">
                      {row.underlyingSymbol}
                      {row.hasWeeklyExpiry ? " · weekly options" : ""}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.chaseEnabled ? row.chaseStatus || "on" : "off"}
                    {row.chaseTradingsymbol ? (
                      <Typography variant="caption" component="p" color="text.secondary">
                        book {row.chaseTradingsymbol}
                        {row.chaseStoploss != null ? ` · SL ${row.chaseStoploss}` : ""}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{contract(row.frontFut)}</TableCell>
                  <TableCell>{contract(row.nextFut)}</TableCell>
                  <TableCell>{contract(row.chaseNewEntry)}</TableCell>
                  <TableCell>
                    {row.optionCurrentExpiry ? `current ${row.optionCurrentExpiry}` : "—"}
                    {row.optionNextExpiry ? (
                      <Typography variant="caption" component="p">
                        next {row.optionNextExpiry}
                      </Typography>
                    ) : null}
                    {row.optionMonthlyExpiry ? (
                      <Typography variant="caption" component="p">
                        monthly {row.optionMonthlyExpiry}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.frontFut?.lotSize || row.lotSize} / {row.strikeStepSize}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollTable>
      </PageSection>
      <Typography color="text.secondary" variant="body2">
        Straddle and strangle pick CE/PE symbols at punch time from the same NFO dump (current /
        next / monthly expiry on the plan). Those option symbols are not stored until a job actually
        places.
      </Typography>
    </Stack>
  )
}
