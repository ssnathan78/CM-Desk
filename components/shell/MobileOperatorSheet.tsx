import EmergencyIcon from "@mui/icons-material/Emergency"
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive"
import {
  Badge,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material"
import Link from "next/link"

import { useDeskStatus } from "../../lib/hooks/useDeskStatus"
import HaltControl from "./HaltControl"

export default function MobileOperatorSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: desk, mutate } = useDeskStatus()
  const errorCount = desk?.alerts?.errorCount ?? 0

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <Stack sx={{ p: 2, pb: 4, maxHeight: "70vh" }} spacing={1}>
        <Typography component="h2" variant="subtitle1">
          Operator
        </Typography>
        {desk ? (
          <HaltControl
            deskHalted={desk.deskHalted}
            haltReason={desk.haltReason}
            onChanged={async () => {
              await mutate()
            }}
          />
        ) : null}
        <List dense>
          <ListItemButton component={Link} href="/desk?view=why&tab=alerts" onClick={onClose}>
            <ListItemIcon>
              <Badge badgeContent={errorCount} color="error">
                <NotificationsActiveIcon />
              </Badge>
            </ListItemIcon>
            <ListItemText primary="Alerts" secondary="Why → failures and blocks" />
          </ListItemButton>
          <ListItemButton component={Link} href="/desk?view=now&tab=today" onClick={onClose}>
            <ListItemIcon>
              <EmergencyIcon />
            </ListItemIcon>
            <ListItemText primary="Desk emergency" secondary="Flatten and kill controls" />
          </ListItemButton>
          <ListItemButton component={Link} href="/chase" onClick={onClose}>
            <ListItemText primary="Chase square-off" secondary="Open Chase books" />
          </ListItemButton>
          <ListItemButton component={Link} href="/risk" onClick={onClose}>
            <ListItemText primary="Risk" />
          </ListItemButton>
          <ListItemButton component={Link} href="/momentum" onClick={onClose}>
            <ListItemText primary="Momentum" />
          </ListItemButton>
          <ListItemButton component={Link} href="/daily-trend" onClick={onClose}>
            <ListItemText primary="Daily trend" />
          </ListItemButton>
        </List>
      </Stack>
    </Drawer>
  )
}
