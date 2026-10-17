---
name: chase-execution
description: Chase minute/hourly execution rules: book qty, adopt leftover, no double flatten, expiry rollover. Use when editing chaseQueue, chaseFill, chaseSignal, placeSL, phantom LONG/SHORT, or rollover.
---

# Chase execution

Three books can disagree: `chase_status`, ledger, Kite. Reconcile is not continuous.

## Do

- Size stops, flatten, and 15:00 rollover from **open qty** (`chaseFlattenQty` / ledger split), never lots.
- If status is LONG/SHORT and qty is 0 → phantom → `AWAITING_SIGNAL`. Do not `JOB_FAILED` flatten.
- If status is `AWAITING_SIGNAL` but qty remains → **adopt** LONG/SHORT from qty; do not fire the opposite entry.
- Protective stop or market flatten already filled for **this** open book (`chaseCoverOrderQty` / `chaseEpisodeCoverFillQty`) → **no** second MARKET. An earlier fill the same day does not cover the new book.
- 09:16 exit uses `planChaseMorningExit`: `purpose: FLATTEN`, status stays LONG/SHORT until qty is flat. A bare MARKET is an entry and halt will block it.
- Kite qty unknown (`kiteQtyKnown: false`) → do not enter and do not clear LONG/SHORT. Unknown is not 0.
- Amend working SL in place (`placeSL`); do not leave the old trigger.
- Halt / trading-disabled: still flatten/SL. Strategy disabled: fully dark.
- **Trade this index** (`enabled`): hourly EMA/signals only when on. Minute SL still runs if LONG/SHORT/AWAITING_*.
- **Pause entries** (`paused`): no new punches; cancel pending entry; open book still trails. Disabled while the index is off.

## Don’t

- Market-enter on the signal bar (except LTP already through the pending trigger).
- Open the dying front month on expiry day if still flat — enter next month.
- Use paper qty when going live.

Spec: `docs/strategies/CHASE.md`. Guard rails: [docs/AGENT_BOOKS_AND_PNL.md](../../../docs/AGENT_BOOKS_AND_PNL.md). Tests: `chaseAdversarial.test.ts`, `chaseFill.test.ts`.
