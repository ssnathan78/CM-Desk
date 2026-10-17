import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from "@mui/material"
import Link from "next/link"
import type { ReactNode } from "react"

import { HELP_PAGES, HELP_TOPICS, type HelpTopic } from "../../lib/helpContent"

export default function HelpTopicLayout({
  topic,
  children,
}: {
  topic: HelpTopic
  children?: ReactNode
}) {
  const page = HELP_PAGES[topic]
  if (!page) return null

  return (
    <>
      <Button component={Link} href="/help" size="small" sx={{ mb: 2 }}>
        All guides
      </Button>
      <Typography variant="h5" component="h1">
        {page.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        {page.summary}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "220px 1fr" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 1, display: { xs: "none", lg: "block" } }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
              On this page
            </Typography>
            <List dense disablePadding>
              {page.sections.map(section => (
                <ListItemButton
                  key={section.id}
                  component="a"
                  href={`#${section.id}`}
                  sx={{ py: 0.25 }}
                >
                  <ListItemText
                    primary={section.title}
                    slotProps={{ primary: { variant: "body2" } }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap", display: { lg: "none" } }}
          >
            {HELP_TOPICS.map(key => (
              <Button
                key={key}
                size="small"
                variant={key === topic ? "contained" : "outlined"}
                component={Link}
                href={`/help/${key}`}
              >
                {HELP_PAGES[key].title}
              </Button>
            ))}
          </Stack>
          <List dense sx={{ display: { xs: "none", md: "block", lg: "none" } }}>
            {HELP_TOPICS.map(key => (
              <ListItemButton
                key={key}
                component={Link}
                href={`/help/${key}`}
                selected={key === topic}
              >
                <ListItemText primary={HELP_PAGES[key].title} />
              </ListItemButton>
            ))}
          </List>
        </Stack>
        <Box>
          <Stack spacing={2}>
            {page.sections.map(section => (
              <Paper id={section.id} key={section.id} sx={{ p: 2.5, scrollMarginTop: 80 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {section.title}
                </Typography>
                {section.body.map(paragraph => (
                  <Typography key={paragraph.slice(0, 48)} color="text.secondary" sx={{ mb: 1 }}>
                    {paragraph}
                  </Typography>
                ))}
              </Paper>
            ))}
          </Stack>
          {children}
          <Typography variant="body2" sx={{ mt: 3 }}>
            <MuiLink component={Link} href="/risk">
              Risk
            </MuiLink>
            {" · "}
            <MuiLink component={Link} href="/desk?view=now">
              Desk Now
            </MuiLink>
            {" · "}
            <MuiLink component={Link} href="/help/desk#status-rail">
              Status rail
            </MuiLink>
          </Typography>
        </Box>
      </Box>
      <Box sx={{ height: 48 }} />
    </>
  )
}
