import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { useMemo, useState } from "react"

export type ConstituentChangeRow = {
  id: number
  symbol: string
  name: string | null
  action: "ADD" | "REMOVE"
  note: string
}

const PAGE_SIZE = 25

export default function ConstituentChanges(props: {
  changes: ConstituentChangeRow[]
  busy: boolean
  caption: string
  addSummary: string
  removeSummary: string
  onRefresh: () => void
  onAccept: (id: number) => void
  onDismiss: (id: number) => void
  onAcceptAll: (side: "ADD" | "REMOVE") => void
  onDismissAll: (side: "ADD" | "REMOVE") => void
}) {
  const [showNames, setShowNames] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const adds = props.changes.filter(row => row.action === "ADD")
  const removes = props.changes.filter(row => row.action === "REMOVE")
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return props.changes
    return props.changes.filter(
      row => row.symbol.includes(q) || (row.name || "").toUpperCase().includes(q)
    )
  }, [props.changes, query])
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Constituents
        </Typography>
        <Button size="small" disabled={props.busy} onClick={props.onRefresh}>
          Refresh constituents
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {props.caption}
      </Typography>
      {props.changes.length === 0 ? (
        <Typography variant="body2">No pending constituent changes.</Typography>
      ) : (
        <Stack spacing={1.5}>
          <Side
            count={adds.length}
            summary={props.addSummary}
            busy={props.busy}
            onAccept={() => props.onAcceptAll("ADD")}
            onDismiss={() => props.onDismissAll("ADD")}
          />
          <Side
            count={removes.length}
            summary={props.removeSummary}
            busy={props.busy}
            onAccept={() => props.onAcceptAll("REMOVE")}
            onDismiss={() => props.onDismissAll("REMOVE")}
          />
          <Button
            size="small"
            sx={{ alignSelf: "flex-start" }}
            onClick={() => setShowNames(v => !v)}
          >
            {showNames ? "Hide names" : `Show names (${props.changes.length})`}
          </Button>
          {showNames ? (
            <>
              <TextField
                size="small"
                label="Filter symbol or name"
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
              />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Change</TableCell>
                    <TableCell>Symbol</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>{row.action === "ADD" ? "Add" : "Drop"}</TableCell>
                      <TableCell>
                        {row.symbol}
                        {row.name && row.name !== row.symbol ? ` · ${row.name}` : ""}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          disabled={props.busy}
                          onClick={() => props.onAccept(row.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="small"
                          disabled={props.busy}
                          onClick={() => props.onDismiss(row.id)}
                        >
                          Dismiss
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                onPageChange={(_event, next) => setPage(next)}
                rowsPerPage={PAGE_SIZE}
                rowsPerPageOptions={[PAGE_SIZE]}
              />
            </>
          ) : null}
        </Stack>
      )}
    </Paper>
  )
}

function Side(props: {
  count: number
  summary: string
  busy: boolean
  onAccept: () => void
  onDismiss: () => void
}) {
  if (!props.count) return null
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ alignItems: { sm: "center" } }}
    >
      <Typography variant="body2" sx={{ flex: 1 }}>
        {props.count}. {props.summary}
      </Typography>
      <Button size="small" disabled={props.busy} onClick={props.onAccept}>
        Accept all
      </Button>
      <Button size="small" disabled={props.busy} onClick={props.onDismiss}>
        Dismiss all
      </Button>
    </Stack>
  )
}
