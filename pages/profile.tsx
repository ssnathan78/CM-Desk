import { Box, Chip, Divider, FormControlLabel, Stack, Switch, Typography } from "@mui/material"
import React, { useEffect, useState } from "react"
import Layout from "../components/Layout"
import PageSection from "../components/lib/PageSection"
import { DeskThemeChoices } from "../components/shell/DeskThemeControl"
import {
  readErrorNotifyEnabled,
  requestNotificationPermission,
  writeErrorNotifyEnabled,
} from "../lib/ui/alertNotifications"
import useUser from "../lib/useUser"

const Profile = () => {
  const { user } = useUser({ redirectTo: "/" })
  const [errorNotify, setErrorNotify] = useState(false)
  const [notifyHint, setNotifyHint] = useState<string | null>(null)

  useEffect(() => {
    setErrorNotify(readErrorNotifyEnabled())
  }, [])

  if (!user?.isLoggedIn) {
    return <Layout title="Profile" loading />
  }

  const rows = [
    ["User ID", user.user_id],
    ["Name", user.user_name],
    ["Email", user.email],
    ["Broker", user.broker],
  ]

  return (
    <Layout title="Profile" maxWidth="sm">
      <Typography variant="h5" sx={{ mb: 1 }}>
        Broker session
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Access tokens stay on the server cookie. This page only shows public profile fields.
      </Typography>
      <Stack spacing={3}>
        <PageSection title="Broker profile" description="Public Kite fields from your session.">
          <Stack spacing={2}>
            {rows.map(([label, value], idx) => (
              <Box key={label}>
                {idx > 0 ? <Divider sx={{ mb: 2 }} /> : null}
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body1">{value || "—"}</Typography>
              </Box>
            ))}
          </Stack>
          <Chip sx={{ mt: 2 }} color="success" variant="outlined" label="Logged in" />
        </PageSection>
        <PageSection
          title="Appearance"
          description="Saved in this browser as desk.theme. It changes colours only. Books, risk, and orders stay as they are."
        >
          <DeskThemeChoices />
        </PageSection>
        <PageSection
          title="Notifications"
          description="Optional desktop alerts for new Desk errors."
        >
          <FormControlLabel
            control={
              <Switch
                checked={errorNotify}
                onChange={async (_, on) => {
                  if (on) {
                    const permission = await requestNotificationPermission()
                    if (permission === "denied") {
                      setNotifyHint("Browser blocked notifications. Allow them in site settings.")
                      writeErrorNotifyEnabled(false)
                      setErrorNotify(false)
                      return
                    }
                    if (permission === "unsupported") {
                      setNotifyHint("This browser does not support desktop notifications.")
                      writeErrorNotifyEnabled(false)
                      setErrorNotify(false)
                      return
                    }
                    setNotifyHint(null)
                  }
                  writeErrorNotifyEnabled(on)
                  setErrorNotify(on)
                }}
              />
            }
            label="Notify when new Desk error alerts appear"
          />
          {notifyHint ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {notifyHint}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Uses local preference desk.errorNotify. Warn-only alerts are not notified.
            </Typography>
          )}
        </PageSection>
      </Stack>
    </Layout>
  )
}

export default Profile
export { getServerSideProps } from "../lib/ssrPage"
