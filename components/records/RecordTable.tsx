import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useState } from "react"

type Props<T> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  minWidth?: number
  onRowClick?: (row: T) => void
  getRowId?: (row: T) => string
}

export default function RecordTable<T>({
  columns,
  data,
  loading,
  error,
  emptyMessage = "Nothing here yet.",
  minWidth = 640,
  onRowClick,
  getRowId,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: getRowId ? row => getRowId(row as T) : undefined,
  })

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    )
  }
  if (error) {
    return (
      <Typography color="error" sx={{ p: 2 }}>
        {error}
      </Typography>
    )
  }

  const rows = table.getRowModel().rows

  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table size="small" stickyHeader sx={{ minWidth }}>
        <TableHead>
          {table.getHeaderGroups().map(hg => (
            <TableRow key={hg.id}>
              {hg.headers.map(header => (
                <TableCell
                  key={header.id}
                  align={
                    (header.column.columnDef.meta as { align?: string })?.align === "right"
                      ? "right"
                      : "left"
                  }
                  onClick={header.column.getToggleSortingHandler()}
                  sx={{
                    cursor: header.column.getCanSort() ? "pointer" : undefined,
                    py: 0.75,
                    ...((header.column.columnDef.meta as { pin?: boolean })?.pin
                      ? {
                          position: "sticky",
                          left: 0,
                          zIndex: 3,
                          bgcolor: "background.paper",
                        }
                      : {}),
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} sx={{ color: "text.secondary" }}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map(row => (
              <TableRow
                key={row.id}
                hover={Boolean(onRowClick)}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                sx={{ height: 32, cursor: onRowClick ? "pointer" : undefined }}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    align={
                      (cell.column.columnDef.meta as { align?: string })?.align === "right"
                        ? "right"
                        : "left"
                    }
                    sx={{
                      py: 0.5,
                      whiteSpace: "nowrap",
                      ...((cell.column.columnDef.meta as { pin?: boolean })?.pin
                        ? {
                            position: "sticky",
                            left: 0,
                            zIndex: 1,
                            bgcolor: "background.paper",
                          }
                        : {}),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
