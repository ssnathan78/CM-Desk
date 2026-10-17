import { Stack } from "@mui/material"
import { useRouter } from "next/router"
import { useEffect } from "react"
import useSWR from "swr"

import RiskControls from "../components/desk/RiskControls"
import Layout from "../components/Layout"
import { DEFAULT_RISK_SETTINGS } from "../lib/trading/riskEngine"
import useUser from "../lib/useUser"

export default function RiskPage() {
  const { user } = useUser({ redirectTo: "/" })
  const router = useRouter()
  const { data: riskData, mutate: mutateRisk } = useSWR(user?.isLoggedIn ? "/api/desk/risk" : null)

  useEffect(() => {
    if (router.query.tab === "risk") {
      router.replace("/risk")
    }
  }, [router.query.tab, router.replace])

  if (!user?.isLoggedIn) {
    return <Layout title="Risk" loading />
  }

  const risk = riskData?.settings ?? DEFAULT_RISK_SETTINGS

  return (
    <Layout title="Risk">
      <Stack spacing={3}>
        <RiskControls
          settings={risk}
          mockOrders={Boolean(riskData?.mockOrders)}
          setups={riskData?.setups}
          onSaved={() => mutateRisk()}
        />
      </Stack>
    </Layout>
  )
}

export { getServerSideProps } from "../lib/ssrPage"
