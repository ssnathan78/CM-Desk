import { TablePagination } from "@mui/material"

import {
  clampTablePage,
  TABLE_ALL_ROWS,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../lib/ui/tablePagination"

export default function StrategyTablePagination({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: {
  count: number
  page: number
  rowsPerPage: number
  onPageChange: (page: number) => void
  onRowsPerPageChange: (rowsPerPage: number) => void
}) {
  const safePage = clampTablePage(page, count, rowsPerPage)

  return (
    <TablePagination
      component="div"
      count={count}
      page={safePage}
      onPageChange={(_event, next) => onPageChange(next)}
      rowsPerPage={rowsPerPage === TABLE_ALL_ROWS ? count || TABLE_ALL_ROWS : rowsPerPage}
      onRowsPerPageChange={e => {
        const next = Number.parseInt(e.target.value, 10)
        onRowsPerPageChange(Number.isFinite(next) ? next : 50)
        onPageChange(0)
      }}
      rowsPerPageOptions={TABLE_PAGE_SIZE_OPTIONS}
      labelDisplayedRows={({ from, to, count: total }) =>
        rowsPerPage === TABLE_ALL_ROWS
          ? `${total} row${total === 1 ? "" : "s"}`
          : `${from}–${to} of ${total}`
      }
    />
  )
}
