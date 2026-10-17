import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined"
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from "@mui/material"
import Link from "next/link"
import useSWR from "swr"

import type { DeskReadiness, ReadinessBlocker } from "../../lib/trading/deskReadiness"
import { color } from "../../src/tokens"

function BlockerIcon({ severity }: { severity: ReadinessBlocker["severity"] }) {
  if (severity === "error") return <ErrorOutlineOutlinedIcon fontSize="small" color="error" />
  if (severity === "warning") return <WarningAmberIcon fontSize="small" color="warning" />
  return <InfoOutlinedIcon fontSize="small" color="info" />
}

export default function GoLiveReadinessPanel({ compact }: { compact?: boolean }) {
  const { data } = useSWR<DeskReadiness>("/api/desk/readiness", { refreshInterval: 15_000 })

  if (!data) {
    return (
      <Paper sx={{ p: compact ? 1.5 : 2 }}>
        <Typography variant="body2" color="text.secondary">
          Loading go-live checklist…
        </Typography>
      </Paper>
    )
  }

  const errors = data.blockers.filter(b => b.severity === "error")

  return (
    <Paper sx={{ p: compact ? 1.5 : 2 }} aria-live="polite">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontWeight: 600 }}>Ready for live?</Typography>
        {data.ready ? (
          <Chip
            size="small"
            icon={<CheckCircleOutlinedIcon />}
            label="No blocking issues"
            sx={{ borderColor: color.profit, color: color.profit }}
            variant="outlined"
          />
        ) : (
          <Chip
            size="small"
            color="error"
            icon={<ErrorOutlineOutlinedIcon />}
            label={`${errors.length} blocker${errors.length === 1 ? "" : "s"}`}
            variant="outlined"
          />
        )}
        <MuiLink component={Link} href="/help/desk#go-live" variant="body2" underline="hover">
          Help
        </MuiLink>
      </Stack>
      {data.blockers.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Allow live orders is on, MOCK_ORDERS is off, and Kite session looks good. Set strategies
          to Live execution on Risk when you are ready to punch.
        </Typography>
      ) : (
        <List dense disablePadding>
          {data.blockers.map(b => (
            <ListItem key={b.id} disableGutters sx={{ alignItems: "flex-start" }}>
              <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                <BlockerIcon severity={b.severity} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box component="span">
                    <MuiLink component={Link} href={b.href} underline="hover">
                      {b.label}
                    </MuiLink>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  )
}
