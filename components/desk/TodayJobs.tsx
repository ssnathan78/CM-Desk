import { Stack } from "@mui/material"

import DueSchedules from "../DueSchedules"
import TradesForDay from "../TradesForDay"

/** Now view: due schedules + today's job cards (emergency panel lives on the desk page). */
export default function TodayJobs() {
  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <DueSchedules />
      <TradesForDay />
    </Stack>
  )
}
