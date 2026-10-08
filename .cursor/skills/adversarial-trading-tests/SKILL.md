---
name: adversarial-trading-tests
description: Required adversarial sequences for live-desk changes. Use when finishing work on orders, risk, ledger, Chase, straddle, strangle, flatten, paper/live, or a new strategy.
---

# Adversarial trading tests

Happy path is not enough. Encode failures that lose money.

## Sequences that must not happen

| Sequence | Must not happen |
|---|---|
| Entry rejected | LONG/SHORT (or equivalent) with empty book |
| SL/flatten when book is flat | Qty falling back to configured lots (opens a position) |
| Paper → Live with paper leftover | Using paper qty on Kite |
| Paper entry while live still has size | Stacking paper on a real book |
| Halt / trading-disabled | Blocking flatten/SL (except strategy **disabled**) |
| One-way Nifty after 9:20 short | Flattening the leftover wing (`*-920-one-way-holds-other-leg`) |
| Restart, duplicate working order, partial, gap through stop | Overfill, double entry, status ≠ ledger qty |
| Protective stop already filled | Second MARKET flatten that reverses |

## Where

- Catalog: `lib/simulation/catalog.ts`
- Tests: `__tests__/simulation/`, `__tests__/unit/trading/`
- Replay: `yarn simulate -- --scenario <name>`
- Always: `yarn unit-test` && `yarn sim-test`

Simulation keeps `SIMULATION=true` and `MOCK_ORDERS=true` — never call Kite.
