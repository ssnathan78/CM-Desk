import { Button, Stack } from "@mui/material"
import type { DeskTab } from "../../../lib/deskNavigation"
import type { DeskInstrumentSnapshot } from "../../../lib/trading/deskInstruments"
import PageSection from "../../lib/PageSection"
import ContractsPanel from "../ContractsPanel"
import DeskMaintenancePanel from "../DeskMaintenancePanel"
import IndexLists from "../IndexLists"
import ReconSummaryCard from "../ReconSummaryCard"
import StrategyReconcile from "../StrategyReconcile"

export default function SetupView({
  tab,
  instrumentData,
  reconciling,
  onReconcile,
  onPaperClear,
  onChaseResetDone,
  onReconcileChanged,
}: {
  tab: DeskTab
  instrumentData: DeskInstrumentSnapshot | undefined
  reconciling: boolean
  onReconcile: () => Promise<void>
  onPaperClear: () => void
  onChaseResetDone: () => void
  onReconcileChanged: () => Promise<void>
}) {
  if (tab === "lists") return <IndexLists />

  if (tab === "contracts") return <ContractsPanel data={instrumentData} />

  if (tab === "broker") {
    return (
      <Stack spacing={3}>
        <ReconSummaryCard />
        <PageSection
          title="Reconcile with broker"
          description="Pulls Kite orders into the ledger. Quantity gaps are recorded, not assigned to a strategy here."
        >
          <Button variant="outlined" disabled={reconciling} onClick={() => onReconcile()}>
            {reconciling ? "Reconciling…" : "Reconcile with broker"}
          </Button>
        </PageSection>
        <StrategyReconcile onChanged={onReconcileChanged} />
      </Stack>
    )
  }

  if (tab === "maintenance") {
    return <DeskMaintenancePanel onPaperClear={onPaperClear} onChaseResetDone={onChaseResetDone} />
  }

  return null
}
