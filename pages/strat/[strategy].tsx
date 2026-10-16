import { Box, Button, Typography } from "@mui/material"
import type { GetServerSideProps } from "next"
import Link from "next/link"

import StratLayout from "../../components/StratLayout"

export const getServerSideProps: GetServerSideProps = async ctx => {
  const strategy = ctx.params?.strategy
  if (strategy === "straddle") {
    return { redirect: { destination: "/templates?type=ATM_STRADDLE", permanent: false } }
  }
  if (strategy === "strangle") {
    return { redirect: { destination: "/templates?type=ATM_STRANGLE", permanent: false } }
  }
  return { props: {} }
}

export default function StrategyRedirect() {
  return (
    <StratLayout>
      <Box sx={{ textAlign: "center", py: 6 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Unknown strategy
        </Typography>
        <Button component={Link} href="/templates">
          Templates
        </Button>
      </Box>
    </StratLayout>
  )
}
