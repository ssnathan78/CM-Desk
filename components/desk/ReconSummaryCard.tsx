import { Alert, Stack, Typography } from "@mui/material"
import useSWR from "swr"
import { formatIstDateTime } from "../../lib/format"
import type { ReconSummary } from "../../lib/trading/reconSummary"
import PageSection from "../lib/PageSection"

export default function ReconSummaryCard() {
  const { data } = useSWR<ReconSummary>("/api/desk/recon-summary", { revalidateOnFocus: false })

  if (!data) {
    return (
      <PageSection title="Reconciliation story">
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      </PageSection>
    )
  }

  const severity = data.status === "ok" ? "success" : data.status === "action" ? "error" : "warning"

  return (
    <PageSection
      title="Reconciliation story"
      description="Ledger vs Kite at a glance before you open reconcile."
    >
      <Alert severity={severity} sx={{ mb: 1.5 }}>
        {data.headline}
      </Alert>
      <Stack component="ul" sx={{ m: 0, pl: 2.5 }} spacing={0.5}>
        {data.bullets.map(line => (
          <Typography key={line} component="li" variant="body2" color="text.secondary">
            {line}
          </Typography>
        ))}
        {data.lastCompletedAt ? (
          <Typography component="li" variant="body2" color="text.secondary">
            Last completed reconcile (IST): {formatIstDateTime(data.lastCompletedAt)}
          </Typography>
        ) : null}
      </Stack>
    </PageSection>
  )
}
