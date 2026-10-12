export type HistoryPreset = "today" | "all" | "month" | "quarter" | "year" | "custom"

function istYmd(at: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at)
}

/** Inclusive IST window for a desk history tab. All time returns no bounds. */
export function historyRange(
  preset: HistoryPreset,
  custom: { from?: string; to?: string } = {},
  now: Date = new Date()
): { from?: string; to?: string } {
  if (preset === "all") return {}
  if (preset === "custom") {
    return {
      from: custom.from ? `${custom.from}T00:00:00+05:30` : undefined,
      to: custom.to ? `${custom.to}T23:59:59+05:30` : undefined,
    }
  }
  const today = istYmd(now)
  const [y, m] = today.split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  const to = `${today}T23:59:59+05:30`
  if (preset === "today") return { from: `${today}T00:00:00+05:30`, to }
  if (preset === "month") return { from: `${y}-${pad(m)}-01T00:00:00+05:30`, to }
  if (preset === "quarter") {
    const qStart = Math.floor((m - 1) / 3) * 3 + 1
    return { from: `${y}-${pad(qStart)}-01T00:00:00+05:30`, to }
  }
  return { from: `${y}-01-01T00:00:00+05:30`, to }
}
