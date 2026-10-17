import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined"
import AllInclusiveOutlinedIcon from "@mui/icons-material/AllInclusiveOutlined"
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined"
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined"
import HubOutlinedIcon from "@mui/icons-material/HubOutlined"
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined"
import MenuIcon from "@mui/icons-material/Menu"
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined"
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined"
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined"
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined"
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined"
import {
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Skeleton,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material"
import { useTheme } from "@mui/material/styles"
import Link from "next/link"
import { useRouter } from "next/router"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import useSWR from "swr"

import fetchJson from "../lib/fetchJson"
import {
  diffErrorCount,
  readErrorNotifyEnabled,
  showErrorNotification,
} from "../lib/ui/alertNotifications"
import useUser from "../lib/useUser"
import DeskKeyboardShortcuts from "./shell/DeskKeyboardShortcuts"
import MobileOperatorSheet from "./shell/MobileOperatorSheet"
import StatusRail from "./shell/StatusRail"

const DRAWER_WIDTH = 260

/** Clearance below fixed AppBar (theme spacing is 4px/unit — do not use small pt values). */
const MAIN_OFFSET = {
  xs: "calc(56px + env(safe-area-inset-top, 0px) + 12px)",
  md: "calc(64px + env(safe-area-inset-top, 0px) + 16px)",
} as const

function pathOnly(asPath: string) {
  return asPath.split("?")[0]
}

function selected(asPath: string, href: string) {
  if (href === "/chase" || href === "/momentum" || href === "/daily-trend") {
    return pathOnly(asPath) === href
  }
  if (href === "/plan" || href === "/templates") {
    return pathOnly(asPath) === href
  }
  if (href === "/help") {
    return pathOnly(asPath) === "/help" || pathOnly(asPath).startsWith("/help/")
  }
  return pathOnly(asPath) === href || pathOnly(asPath).startsWith(`${href}/`)
}

const itemSx = {
  mb: 0.25,
  borderRadius: 2,
  pl: 2,
  "&.Mui-selected": {
    backgroundColor: "rgba(45, 212, 191, 0.12)",
    color: "primary.main",
  },
}

type AppShellProps = {
  children: React.ReactNode
  title?: string
  maxWidth?: "sm" | "md" | "lg" | "xl" | false
}

export default function AppShell({ children, title, maxWidth = "lg" }: AppShellProps) {
  const { user, mutateUser } = useUser()
  const router = useRouter()
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down("md"))
  const phone = useMediaQuery(theme.breakpoints.down("sm"))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [operatorSheetOpen, setOperatorSheetOpen] = useState(false)
  const asPath = router.asPath
  const { data: alertSummary } = useSWR(user?.isLoggedIn ? "/api/desk/alerts?summary=1" : null, {
    refreshInterval: 15_000,
  })
  const alertCount = Number(alertSummary?.errorCount ?? 0) + Number(alertSummary?.warnCount ?? 0)
  const prevErrorCount = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!user?.isLoggedIn || !readErrorNotifyEnabled()) return
    const next = Number(alertSummary?.errorCount ?? 0)
    const delta = diffErrorCount(prevErrorCount.current, next)
    if (delta > 0) {
      showErrorNotification(
        delta === 1 ? "1 new error alert on Desk" : `${delta} new error alerts on Desk`
      )
    }
    prevErrorCount.current = next
  }, [alertSummary?.errorCount, user?.isLoggedIn])

  const close = () => setMobileOpen(false)

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", px: 1.5, py: 2 }}>
      <Box sx={{ px: 1.5, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: "primary.main", letterSpacing: "0.16em" }}>
          CM-DESK
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Algo desk
        </Typography>
      </Box>
      <List dense sx={{ flex: 1, py: 0 }} subheader={<li />}>
        <ListItemButton
          component={Link}
          href={alertCount ? "/desk?view=why&tab=alerts" : "/desk"}
          selected={selected(asPath, "/desk")}
          onClick={close}
          sx={{ ...itemSx, pl: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <Badge color="error" badgeContent={alertCount} max={9}>
              <SpaceDashboardOutlinedIcon fontSize="small" />
            </Badge>
          </ListItemIcon>
          <ListItemText primary="Desk" />
        </ListItemButton>
        <ListItemButton
          component={Link}
          href="/risk"
          selected={selected(asPath, "/risk")}
          onClick={close}
          sx={itemSx}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <ShieldOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Risk" />
        </ListItemButton>

        <ListSubheader
          disableSticky
          sx={{ bgcolor: "transparent", color: "text.secondary", lineHeight: 2.4, mt: 1 }}
        >
          Intraday
        </ListSubheader>
        <ListItemButton
          component={Link}
          href="/templates"
          selected={selected(asPath, "/templates")}
          onClick={close}
          sx={itemSx}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <DescriptionOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Templates" />
        </ListItemButton>
        <ListItemButton
          component={Link}
          href="/plan"
          selected={selected(asPath, "/plan")}
          onClick={close}
          sx={itemSx}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <CalendarMonthOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Schedules" />
        </ListItemButton>

        <ListSubheader
          disableSticky
          sx={{ bgcolor: "transparent", color: "text.secondary", lineHeight: 2.4, mt: 1 }}
        >
          Continuous
        </ListSubheader>
        <ListItemButton
          component={Link}
          href="/chase"
          selected={selected(asPath, "/chase")}
          onClick={close}
          sx={itemSx}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <AllInclusiveOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Chase" />
        </ListItemButton>
        <ListItemButton
          component={Link}
          href="/momentum"
          selected={selected(asPath, "/momentum")}
          onClick={close}
          sx={itemSx}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <TrendingUpOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Momentum" />
        </ListItemButton>
        <ListItemButton
          component={Link}
          href="/daily-trend"
          selected={selected(asPath, "/daily-trend")}
          onClick={close}
          sx={itemSx}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <ShowChartOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Daily trend" />
        </ListItemButton>

        <ListSubheader
          disableSticky
          sx={{ bgcolor: "transparent", color: "text.secondary", lineHeight: 2.4, mt: 1 }}
        >
          Ops
        </ListSubheader>
        <ListItemButton
          component="a"
          href="/queues"
          target="_blank"
          rel="noreferrer"
          sx={{ ...itemSx, pl: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <HubOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Queues" />
        </ListItemButton>
      </List>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ px: 0.5 }}>
        <ListItemButton
          component={Link}
          href="/help"
          selected={selected(asPath, "/help")}
          onClick={close}
          sx={{ borderRadius: 2 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <MenuBookOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Guide" />
        </ListItemButton>
        {user?.isLoggedIn ? (
          <>
            <Box sx={{ px: 2, py: 1 }}>
              {user.avatar_url ? (
                <Avatar
                  alt={user.user_shortname || "user"}
                  src={user.avatar_url}
                  sx={{ width: 28, height: 28, mb: 0.5 }}
                />
              ) : null}
              <Typography variant="body2" noWrap>
                {user.user_name || user.user_shortname || user.user_id}
              </Typography>
            </Box>
            <ListItemButton
              component={Link}
              href="/profile"
              sx={{ borderRadius: 2 }}
              onClick={close}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <AccountCircleOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Profile" />
            </ListItemButton>
            <ListItemButton
              sx={{ borderRadius: 2 }}
              onClick={async () => {
                await mutateUser(fetchJson("/api/logout", { method: "POST" }))
                router.push("/")
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <LogoutOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Log out" />
            </ListItemButton>
          </>
        ) : (
          <ListItemButton component={Link} href="/" sx={{ borderRadius: 2 }}>
            <ListItemText primary="Log in" />
          </ListItemButton>
        )}
      </Box>
    </Box>
  )

  const widths = { sm: 600, md: 900, lg: 1140, xl: 1400 }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", minWidth: 0, overflowX: "clip" }}>
      <DeskKeyboardShortcuts />
      {phone ? (
        <MobileOperatorSheet open={operatorSheetOpen} onClose={() => setOperatorSheetOpen(false)} />
      ) : null}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "rgba(8, 12, 20, 0.78)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid",
          borderColor: "divider",
          ml: { md: `${DRAWER_WIDTH}px` },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, md: 64 },
            px: { xs: 1, sm: 2 },
            gap: 1,
            flexWrap: { xs: "wrap", lg: "nowrap" },
            py: { xs: 0.5, md: 0 },
          }}
        >
          {compact ? (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          ) : null}
          <Typography
            variant="h6"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              mr: 2,
            }}
          >
            {title || "CM-Desk"}
          </Typography>
          <StatusRail loggedIn={Boolean(user?.isLoggedIn)} compact={compact} />
          {user === undefined ? <Skeleton variant="rounded" width={88} height={28} /> : null}
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          slotProps={{ root: { keepMounted: true } }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, bgcolor: "#0c1422" },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              bgcolor: "#0c1422",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          width: { xs: "100%", md: `calc(100% - ${DRAWER_WIDTH}px)` },
          pt: MAIN_OFFSET,
          pb: { xs: 12, md: 6 },
          px: { xs: 1.5, sm: 2, md: 4 },
        }}
      >
        <Box
          sx={{
            maxWidth: maxWidth === false ? "none" : widths[maxWidth],
            mx: "auto",
            minWidth: 0,
            width: "100%",
          }}
        >
          {children}
        </Box>
      </Box>
      <BottomNavigation
        showLabels
        value={["/desk", "/templates", "/chase"].find(href => selected(asPath, href)) ?? false}
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.appBar,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "#0c1422",
          height: "calc(56px + env(safe-area-inset-bottom))",
          pb: "env(safe-area-inset-bottom)",
        }}
      >
        <BottomNavigationAction
          label="Desk"
          value="/desk"
          icon={
            <Badge color="error" badgeContent={alertCount} max={9}>
              <SpaceDashboardOutlinedIcon />
            </Badge>
          }
          component={Link}
          href={alertCount ? "/desk?view=why&tab=alerts" : "/desk"}
        />
        <BottomNavigationAction
          label="Templates"
          value="/templates"
          icon={<DescriptionOutlinedIcon />}
          component={Link}
          href="/templates"
        />
        <BottomNavigationAction
          label="Chase"
          value="/chase"
          icon={<AllInclusiveOutlinedIcon />}
          component={Link}
          href="/chase"
        />
        <BottomNavigationAction
          label="More"
          value="/more"
          icon={<MenuIcon />}
          onClick={() => (phone ? setOperatorSheetOpen(true) : setMobileOpen(true))}
        />
      </BottomNavigation>
    </Box>
  )
}
