import { Stack, Typography } from "@mui/material"
import { useState } from "react"
import useSWR from "swr"

import fetchJson from "../../lib/fetchJson"
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
          message += ` Deletes ${affected.length} daily-trend book(s): ${affected.slice(0, 8).join(", ")}${affected.length > 8 ? "…" : ""}.`
        }
      }
      if (book === "trend" && side === "ADD" && preview.preview.trend?.wouldAdd.length) {
        const names = preview.preview.trend.wouldAdd
        message += ` Adds ${names.length} book(s) with On off: ${names.slice(0, 8).join(", ")}${names.length > 8 ? "…" : ""}.`
      }
      if (book === "momentum" && preview.preview.momentum?.symbols.length) {
        const names = preview.preview.momentum.symbols
        message += ` ${side === "ADD" ? "Adds" : "Removes"} ${names.length} rank-list name(s): ${names.slice(0, 8).join(", ")}${names.length > 8 ? "…" : ""}.`
      }
      setPendingAccept({ book, side, message })
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Preview failed", "error")
    }
  }

  return (
    <Stack spacing={2}>
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
        onAccept={id =>
          void post({ book: "momentum", action: "accept", id }, "Constituent accepted")
        }
        onDismiss={id =>
          void post({ book: "momentum", action: "dismiss", id }, "Constituent dismissed")
        }
        onAcceptAll={side => void confirmAcceptAll("momentum", side)}
        onDismissAll={side =>
          void post({ book: "momentum", action: "dismiss-all", side }, "Constituents dismissed")
        }
      />
      <ConstituentChanges
        changes={data?.trend ?? []}
        busy={false}
        caption="Nifty 100, from niftyindices.com. A new name is added on the daily-trend page with On off. A removal waits here. Accept does not sell."
        addSummary="Other adds waiting for Accept. Accept puts the name on the book with On off and does not buy."
        removeSummary="Names leaving Nifty 100. Accept all deletes those books and does not sell."
        onRefresh={() => void post({ book: "trend", action: "refresh" }, "Constituents refreshed")}
        onAccept={id => void post({ book: "trend", action: "accept", id }, "Constituent accepted")}
        onDismiss={id =>
          void post({ book: "trend", action: "dismiss", id }, "Constituent dismissed")
        }
        onAcceptAll={side => void confirmAcceptAll("trend", side)}
        onDismissAll={side =>
          void post({ book: "trend", action: "dismiss-all", side }, "Constituents dismissed")
        }
      />
    </Stack>
  )
}
