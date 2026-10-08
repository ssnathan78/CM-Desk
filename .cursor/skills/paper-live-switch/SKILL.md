---
name: paper-live-switch
description: Handles paper vs live books, go-live, clear paper, and CHASE_OTHER_BOOK. Use when switching execution mode, mixing paper leftover with Kite, clear paper book, or provenance bugs.
---

# Paper vs live switch

Live punch needs **all three**: `MOCK_ORDERS=false`, Desk Allow live orders, strategy Execution = Live.

## Rules

- Size live from **configured lots** after paper is archived — never from paper qty.
- Live/Kite size still open → refuse paper (`CHASE_OTHER_BOOK` / `OTHER_BOOK`).
- Paper → Live: `prepareStrategyGoLive` archives paper, resets Chase status for every index.
- Clear paper (`clearPaperBook`) deletes paper/mock ledger rows; does **not** send a broker order; refuses if paper is still open or a paper order is working.
- Clear phantom zeros one leftover row; not a Kite flatten.

Replay: `yarn simulate -- --scenario chase-paper-to-live-open` (also straddle/strangle variants) and `chase-live-to-paper-open`.
