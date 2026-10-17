import { Stack, Typography } from "@mui/material"
import { useState } from "react"
import useSWR from "swr"

import fetchJson from "../../lib/fetchJson"
import { constituentDropConfirm, constituentKeepConfirm } from "../../lib/operatorActionCopy"
import ConfirmAction from "../lib/ConfirmAction"
import { useSnackbar } from "../lib/useSnackbar"
import ConstituentChanges, { type ConstituentChangeRow } from "./ConstituentChanges"

type Payload = {
  momentum: ConstituentChangeRow[]
  trend: ConstituentChangeRow[]
  message?: string
}

type PreviewPayload = {
  preview: {
    trend?: {
      wouldAdd: string[]
      wouldRemove: string[]
      openBooksAffected: string[]
    }
    momentum?: { symbols: string[]; side: "ADD" | "REMOVE" }
  }
  count: number
  side: "ADD" | "REMOVE"
  book: "momentum" | "trend"
}

export default function IndexLists() {
  const { showMessage } = useSnackbar()
  const { data, mutate } = useSWR<Payload>("/api/desk/constituents", { revalidateOnFocus: false })
  const [pendingAccept, setPendingAccept] = useState<{
    book: "momentum" | "trend"
    side: "ADD" | "REMOVE"
    message: string
  } | null>(null)
  const [pendingDrop, setPendingDrop] = useState<{
    book: "momentum" | "trend"
    id: number
    symbol: string
  } | null>(null)
  const [pendingKeep, setPendingKeep] = useState<{
    book: "momentum" | "trend"
    side: "ADD" | "REMOVE"
    count: number
  } | null>(null)

  async function post(body: Record<string, unknown>, ok: string) {
    try {
      const result = await fetchJson<Payload>("/api/desk/constituents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      await mutate()
      showMessage(result.message || ok, result.message ? "info" : "success")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Constituent update failed", "error")
    }
  }

  async function confirmAcceptAll(book: "momentum" | "trend", side: "ADD" | "REMOVE") {
    try {
      const preview = await fetchJson<PreviewPayload>("/api/desk/constituents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", book, side }),
      })
      if (!preview.count) {
        showMessage("No pending changes on that side", "info")
        return
      }
      let message = `Accept all ${preview.count} ${side === "ADD" ? "adds" : "drops"}? This does not place orders.`
      if (book === "trend" && side === "REMOVE" && preview.preview.trend) {
        const affected = preview.preview.trend.openBooksAffected
        if (affected.length) {
          message += ` Deletes ${affected.length} daily-trend book(s): ${affected.join(", ")}. Shares at the broker stay. The stop will not run.`
        }
      }
      if (book === "trend" && side === "ADD" && preview.preview.trend?.wouldAdd.length) {
        const names = preview.preview.trend.wouldAdd
        message += ` Adds ${names.length} book(s) with On off: ${names.join(", ")}.`
      }
      if (book === "momentum" && preview.preview.momentum?.symbols.length) {
        const names = preview.preview.momentum.symbols
        message += ` ${side === "ADD" ? "Adds" : "Removes"} ${names.length} rank-list name(s): ${names.join(", ")}. This does not sell.`
      }
      setPendingAccept({ book, side, message })
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Preview failed", "error")
    }
  }

  return (
    <Stack spacing={2}>
      <ConfirmAction
        open={Boolean(pendingDrop)}
        tone="attention"
        title={
          pendingDrop
            ? constituentDropConfirm(pendingDrop.book, pendingDrop.symbol).title
            : "Drop this name?"
        }
        message={
          pendingDrop ? constituentDropConfirm(pendingDrop.book, pendingDrop.symbol).message : ""
        }
        confirmLabel="Drop from list"
        onCancel={() => setPendingDrop(null)}
        onConfirm={async () => {
          if (!pendingDrop) return
          const drop = pendingDrop
          setPendingDrop(null)
          await post({ book: drop.book, action: "accept", id: drop.id }, `${drop.symbol} dropped`)
        }}
      />
      <ConfirmAction
        open={Boolean(pendingKeep)}
        tone="attention"
        title={
          pendingKeep
            ? constituentKeepConfirm(pendingKeep.book, pendingKeep.side, pendingKeep.count).title
            : "Keep these names?"
        }
        message={
          pendingKeep
            ? constituentKeepConfirm(pendingKeep.book, pendingKeep.side, pendingKeep.count).message
            : ""
        }
        confirmLabel={pendingKeep?.side === "REMOVE" ? "Keep names" : "Skip adds"}
        onCancel={() => setPendingKeep(null)}
        onConfirm={async () => {
          if (!pendingKeep) return
          const keep = pendingKeep
          setPendingKeep(null)
          await post(
            { book: keep.book, action: "dismiss-all", side: keep.side },
            "Constituents dismissed"
          )
        }}
      />
      <ConfirmAction
        open={Boolean(pendingAccept)}
        tone="attention"
        title="Accept all constituent changes?"
        message={pendingAccept?.message ?? ""}
        confirmLabel="Accept all"
        onCancel={() => setPendingAccept(null)}
        onConfirm={async () => {
          if (!pendingAccept) return
          const { book, side } = pendingAccept
          setPendingAccept(null)
          await post({ book, action: "accept-all", side }, "Constituents accepted")
        }}
      />
      <Typography variant="body2" color="text.secondary">
        The weekly check updates these lists on its own. Open this tab when an alert says a name was
        added or a download failed. Accept changes the saved list and does not place an order.
      </Typography>
      <ConstituentChanges
        changes={data?.momentum ?? []}
        busy={false}
        caption="Nifty Total Market, from niftyindices.com. This is the momentum rank list."
        addSummary="Names in the current file that are not on the rank list. Accept all adds them and does not buy."
        removeSummary="Names on the rank list that are not in the current file. Accept all drops them and does not sell."
        onRefresh={() =>
          void post({ book: "momentum", action: "refresh" }, "Constituents refreshed")
        }
        onAccept={id => {
          const row = (data?.momentum ?? []).find(item => item.id === id)
          if (row?.action === "REMOVE") {
            setPendingDrop({ book: "momentum", id, symbol: row.symbol })
            return
          }
          void post({ book: "momentum", action: "accept", id }, "Constituent accepted")
        }}
        onDismiss={id =>
          void post({ book: "momentum", action: "dismiss", id }, "Constituent dismissed")
        }
        onAcceptAll={side => void confirmAcceptAll("momentum", side)}
        onDismissAll={side =>
          setPendingKeep({
            book: "momentum",
            side,
            count: (data?.momentum ?? []).filter(row => row.action === side).length,
          })
        }
      />
      <ConstituentChanges
        changes={data?.trend ?? []}
        busy={false}
        caption="Nifty 100, from niftyindices.com. A new name is added on the daily-trend page with On off. A removal waits here. Accept does not sell."
        addSummary="Other adds waiting for Accept. Accept puts the name on the book with On off and does not buy."
        removeSummary="Names leaving Nifty 100. Accept all deletes those books. Shares stay at the broker and the stop will not run."
        onRefresh={() => void post({ book: "trend", action: "refresh" }, "Constituents refreshed")}
        onAccept={id => {
          const row = (data?.trend ?? []).find(item => item.id === id)
          if (row?.action === "REMOVE") {
            setPendingDrop({ book: "trend", id, symbol: row.symbol })
            return
          }
          void post({ book: "trend", action: "accept", id }, "Constituent accepted")
        }}
        onDismiss={id =>
          void post({ book: "trend", action: "dismiss", id }, "Constituent dismissed")
        }
        onAcceptAll={side => void confirmAcceptAll("trend", side)}
        onDismissAll={side =>
          setPendingKeep({
            book: "trend",
            side,
            count: (data?.trend ?? []).filter(row => row.action === side).length,
          })
        }
      />
    </Stack>
  )
}
