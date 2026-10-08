---
name: strategy-change
description: Workflow for changing Chase, ATM straddle, or strangle without violating the operator spec. Use when editing strategies, exits, Chase queue/signal/fill, 9:20 legs, rollover, SL, or adding a strategy.
---

# Strategy change

## Before code

1. Read the spec in `docs/strategies/` (Chase, ATM_STRADDLE, ATM_STRANGLE).
2. Name sequences that can phantom-status, mix paper/live, flatten the wrong size, or **open** while exiting.
3. Do not flatten a leftover 9:20 wing because the other SL hit. Do not size flatten from configured lots.

## Chase specifics

- Fill required for LONG/SHORT. Risk reject stays `AWAITING_*`.
- Flatten/SL/rollover qty = open book, not lots.
- If the stop already filled, no second MARKET flatten.
- Expiry 15:00 IST: flatten front, open next; new entries on expiry day already use next month.
- Halt still allows flatten/SL; strategy disabled does not.

## After code

1. Catalog cases in `lib/simulation/catalog.ts` + `__tests__/simulation/` (see `chaseAdversarial.test.ts`, `strategyAdversarial.test.ts`).
2. Hermetic unit matrices (`__tests__/unit/`).
3. `yarn unit-test` and `yarn sim-test`.
4. New strategy: `RISK_STRATEGY_KEYS`, Desk → Risk, sim actor that calls production `evaluateOrder`.
5. Update the spec if behavior changed.
