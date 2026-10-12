import { Alert } from "@mui/material"
import { useEffect, useState } from "react"

export type NoticeLevel = "success" | "error" | "info"

export type ActionNoticeState = {
  text: string
  severity: NoticeLevel
}

const FADE_MS = 5000

/** Page or section result. Success and info fade. An error stays until dismissed or replaced. */
export function useActionNotice() {
  const [notice, setNotice] = useState<ActionNoticeState | null>(null)

  useEffect(() => {
    if (!notice || notice.severity === "error") return
    const timer = window.setTimeout(() => setNotice(null), FADE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const showNotice = (text: string, severity: NoticeLevel = "info") => {
    setNotice({ text, severity })
  }

  const clearNotice = () => setNotice(null)

  const NoticeBanner = notice ? (
    <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={clearNotice}>
      {notice.text}
    </Alert>
  ) : null

  return { notice, showNotice, clearNotice, NoticeBanner }
}

/** One result per table row. Success and info fade. An error stays until that row is used again. */
export function useRowNotices() {
  const [rows, setRows] = useState<Record<string, ActionNoticeState>>({})

  useEffect(() => {
    const fading = Object.values(rows).some(note => note.severity !== "error")
    if (!fading) return
    const timer = window.setTimeout(() => {
      setRows(current => {
        const next: Record<string, ActionNoticeState> = {}
        for (const [key, note] of Object.entries(current)) {
          if (note.severity === "error") next[key] = note
        }
        return next
      })
    }, FADE_MS)
    return () => window.clearTimeout(timer)
  }, [rows])

  const showRow = (key: string, text: string, severity: NoticeLevel) => {
    setRows(current => ({ ...current, [key]: { text, severity } }))
  }

  return { rows, showRow }
}
