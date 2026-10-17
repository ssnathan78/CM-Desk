---
name: risk-flags
description: Explains Desk Risk checkboxes vs Halt new entries vs per-strategy halt/disable. Use when the operator asks about trading enabled, halt, resume, kill desk, LIVE_BLOCKED, or why flatten still works.
---

# Risk flags

Pre-trade: `evaluateOrder` in `lib/trading/riskEngine.ts` via `assertOrderAllowed`. Strategy code cannot bypass it.

## Desk-wide new entries

| UI | Setting | Reject code | Flatten/SL |
|---|---|---|---|
| Trading enabled (checkbox) | `tradingEnabled` | `TRADING_DISABLED` | yes |
| Halt new entries (header) | `deskHalted` + `haltReason` | `DESK_HALTED` | yes |

Halt logs `KILL_SWITCH`. Resume (`resumeDesk`) clears halt **and sets `tradingEnabled` true**. Engine checks halt **before** trading-enabled.

## Per strategy

| UI | Effect |
|---|---|
| Strategy enabled off | **Every** order blocked (`STRATEGY_DISABLED`) — including flatten |
| Not halted unchecked | Entries blocked (`STRATEGY_HALTED`); flatten/SL still work |
| Execution Paper / Live | Live still needs `MOCK_ORDERS=false` + Allow live orders |

Kill-desk / `runDeskKill` aborts jobs then `haltDesk`. `chasePaused` and `deskHalted` are true only after those writes succeed. A failed halt is HTTP 500. The panel uses `killOperatorNotice`. Resume is always **manual**.

`kite.modifyOrder` and `kite.cancelOrder` on a stop call `assertLiveBrokerMutation`. A live flatten while the market is closed is refused and the stop stays. `getRiskSettings` throws when the row cannot be read.

Guide: [docs/AGENT_ORDER_SAFETY.md](../../../docs/AGENT_ORDER_SAFETY.md).
