import { Button, Typography } from "@mui/material"
import Link from "next/link"
import { useRouter } from "next/router"

import HelpTopicLayout from "../../components/help/HelpTopicLayout"
import Layout from "../../components/Layout"
import { HELP_PAGES, type HelpTopic } from "../../lib/helpContent"

const HelpTopicPage = () => {
  const router = useRouter()
  const topic = router.query.topic as HelpTopic
  const page = HELP_PAGES[topic]

  if (!router.isReady) {
    return <Layout title="Guide" loading />
  }

  if (!page) {
    return (
      <Layout title="Guide">
        <Typography variant="h6">Unknown guide</Typography>
        <Button component={Link} href="/help">
          All guides
        </Button>
      </Layout>
    )
  }

  return (
    <Layout title={page.title} maxWidth="md">
      <HelpTopicLayout topic={topic} />
    </Layout>
  )
}

export default HelpTopicPage
export { getServerSideProps } from "../../lib/ssrPage"
