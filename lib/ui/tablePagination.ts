/** MUI TablePagination: -1 means show all rows on one page. */
export const TABLE_ALL_ROWS = -1

export const TABLE_PAGE_SIZE_OPTIONS: (number | { value: number; label: string })[] = [
  10,
  20,
  50,
  100,
  { value: TABLE_ALL_ROWS, label: "All" },
]

export function paginateSlice<T>(rows: T[], page: number, rowsPerPage: number): T[] {
  if (rowsPerPage === TABLE_ALL_ROWS || rowsPerPage <= 0) return rows
  const start = page * rowsPerPage
  return rows.slice(start, start + rowsPerPage)
}

export function tablePageCount(count: number, rowsPerPage: number): number {
  if (count === 0) return 1
  if (rowsPerPage === TABLE_ALL_ROWS || rowsPerPage <= 0) return 1
  return Math.ceil(count / rowsPerPage)
}

export function clampTablePage(page: number, count: number, rowsPerPage: number): number {
  const pages = tablePageCount(count, rowsPerPage)
  return Math.max(0, Math.min(page, pages - 1))
}
