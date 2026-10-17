import { reorderVisibleColumn } from "../../lib/ui/columnVisibility"
import {
  clampTablePage,
  paginateSlice,
  TABLE_ALL_ROWS,
  tablePageCount,
} from "../../lib/ui/tablePagination"

const TEST_COLS = [
  { id: "a" as const, label: "A", locked: true },
  { id: "b" as const, label: "B" },
  { id: "c" as const, label: "C" },
]

describe("tablePagination", () => {
  const rows = [1, 2, 3, 4, 5]

  it("slices by page and rowsPerPage", () => {
    expect(paginateSlice(rows, 0, 2)).toEqual([1, 2])
    expect(paginateSlice(rows, 1, 2)).toEqual([3, 4])
  })

  it("returns all rows when rowsPerPage is All", () => {
    expect(paginateSlice(rows, 0, TABLE_ALL_ROWS)).toEqual(rows)
  })

  it("computes page count and clamps page", () => {
    expect(tablePageCount(5, 2)).toBe(3)
    expect(clampTablePage(9, 5, 2)).toBe(2)
    expect(clampTablePage(0, 0, 50)).toBe(0)
  })

  it("reorders visible columns without moving locked", () => {
    const visible = ["a", "b", "c"] as ("a" | "b" | "c")[]
    expect(reorderVisibleColumn(visible, "c", -1, TEST_COLS)).toEqual(["a", "c", "b"])
    expect(reorderVisibleColumn(visible, "a", 1, TEST_COLS)).toEqual(visible)
  })
})
