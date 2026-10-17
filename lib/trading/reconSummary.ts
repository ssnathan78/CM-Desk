export type ReconEventRow = {
  id: number
  kind: string
  severity: string
  tradingsymbol: string | null
  detail: string | null
  occurredAt: Date
  resolved: boolean
}

export type ReconSummaryInput = {
  unresolved: ReconEventRow[]
  lastCompletedAt: Date | null
  openLedgerPositions: number
  reconAlertCount: number
}

export type ReconSummary = {
  status: "ok" | "attention" | "action"
  headline: string
  bullets: string[]
  unresolvedCount: number
  lastCompletedAt: string | null
  openLedgerPositions: number
}

export function buildReconSummary(input: ReconSummaryInput): ReconSummary {
  const unresolvedCount = input.unresolved.length
  const lastCompletedAt = input.lastCompletedAt?.toISOString() ?? null

  if (unresolvedCount === 0 && input.reconAlertCount === 0) {
    const bullets: string[] = []
    if (lastCompletedAt) {
      bullets.push("Last successful reconcile is recorded in the audit log.")
    } else {
      bullets.push("No reconcile run recorded yet today — use Reconcile with broker after login.")
    }
    bullets.push(`${input.openLedgerPositions} open ledger position row(s) on the desk.`)
    return {
      status: "ok",
      headline: "Broker and ledger are in sync on recorded mismatches.",
      bullets,
      unresolvedCount: 0,
      lastCompletedAt,
      openLedgerPositions: input.openLedgerPositions,
    }
  }

  const symbols = [
    ...new Set(input.unresolved.map(r => r.tradingsymbol).filter(Boolean) as string[]),
  ].slice(0, 5)
  const bullets = [
    `${unresolvedCount} unresolved reconciliation event(s) in the audit trail.`,
    input.reconAlertCount
      ? `${input.reconAlertCount} recon alert(s) still visible in Why → Alerts.`
      : "Check Why → Alerts for broker rejects that never became fills.",
  ]
  if (symbols.length) {
    bullets.push(`Symbols flagged: ${symbols.join(", ")}${unresolvedCount > 5 ? "…" : ""}.`)
  }
  if (lastCompletedAt) {
    bullets.push("A reconcile completed earlier — see Activity for the exact time.")
  }
  bullets.push(
    "Run Reconcile with broker, then attribute quantity on Strategy reconcile if a book is tagged wrong."
  )

  const hasError = input.unresolved.some(r => r.severity === "ERROR")
  return {
    status: hasError ? "action" : "attention",
    headline: hasError
      ? "Reconciliation needs operator action before you trust live size."
      : "Open reconciliation gaps — review before going live.",
    bullets,
    unresolvedCount,
    lastCompletedAt,
    openLedgerPositions: input.openLedgerPositions,
  }
}
