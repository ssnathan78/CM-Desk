import {
  Dialog,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material"
import { useRouter } from "next/router"
import { useEffect, useRef, useState } from "react"

import { DESK_SHORTCUTS } from "../../lib/ui/keyboardShortcuts"

export default function DeskKeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pendingG = useRef(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return

      if (event.key === "?" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        setOpen(v => !v)
        return
      }

      if (event.key === "g" && !event.metaKey && !event.ctrlKey) {
        pendingG.current = true
        window.setTimeout(() => {
          pendingG.current = false
        }, 800)
        return
      }

      if (pendingG.current && event.key === "d") {
        event.preventDefault()
        pendingG.current = false
        void router.push("/desk")
      }
      if (pendingG.current && event.key === "r") {
        event.preventDefault()
        pendingG.current = false
        void router.push("/risk")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Keyboard shortcuts</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Keys</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {DESK_SHORTCUTS.map(row => (
              <TableRow key={row.keys}>
                <TableCell sx={{ fontFamily: "var(--font-mono)" }}>{row.keys}</TableCell>
                <TableCell>{row.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}
