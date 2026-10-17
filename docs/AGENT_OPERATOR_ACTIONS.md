# Agent guide: operator actions

Read this before adding or changing a button, switch, confirm, toast, filter, or P&L figure the operator can act on. Order safety is [AGENT_ORDER_SAFETY.md](AGENT_ORDER_SAFETY.md). Books and P&L measures are [AGENT_BOOKS_AND_PNL.md](AGENT_BOOKS_AND_PNL.md).

CM-Desk is a strategy desk. The operator does not watch the market here. A control that undersells its effect, a success line after a reject, or two rupee figures with the same name and different meanings will be used wrong.

The sentences the operator reads live in `lib/operatorActionCopy.ts`. A new confirm, toast, or label that decides what happened belongs in that file (or `lib/killNotice.ts` / `lib/flattenNotice.ts` for Kill and flatten), with a hermetic test in `__tests__/unit/operatorActionCopy.test.ts`. Do not write the sentence only inside a click handler.

The API phrases for square-off, Kill, Allow live orders, and reconcile accept live in `lib/operatorConfirm.ts`. The dialog sends the phrase. The route rejects the action without it. See [AGENT_SESSION_BOUNDARY.md](AGENT_SESSION_BOUNDARY.md).

## Conditions

| What the operator sees | What is stored |
|---|---|
| Momentum and Daily trend Engine / Execution menus | Draft until **Save**. Send, Evaluate and send, and the hourly pass use the saved row. |
| Momentum **Save and pull history** | Writes the draft, then downloads. |
| Daily trend **Pull history now** | Does not write the draft. It uses the saved Engine. |
| Daily trend symbol **On** off | Fully dark: no buy and no stop. The stored stop price stays. Shares at the broker stay. |
| Daily trend **Pause** | Blocks a new buy. The stop still sells. |
| Chase row **Square off this book** | `{ strategy: "CHASE", instrument }` — that book only. `{ strategy: "CHASE" }` with no instrument flattens every Chase book, including added stocks. |
| Desk → Today **Run now…** / **Queue for HH:mm** | `dueScheduleRunsNow`. After the template clock, enqueue runs the job now. |
| Kill | `deskHalted` and `chasePaused` are true only after those writes. `flattenFailed` means the flatten call threw. A closed market leaves the live book and its stop. |
| Chase **Reset all books** | One open or unproved book refuses the whole reset. Nothing is changed. The confirm lists every book, not only the four indexes. |
| Lists **Accept** on a drop | Deletes the daily-trend book or the momentum rank name. It does not sell. **Keep these names** leaves the book in place. |

## Boundaries

- A result stays on the dialog that asked for the action (`ConfirmAction` `outcome`). Do not paint success and failure with the same red banner at the top of Desk.
- Do not close that dialog before the reply. A throw, a `skipped` row, or `submitted.ok === false` is not "sent" and not "finished".
- Momentum rebalance still marks the IST day done when Kite rejects a line. The notice must say the day will not be retried. Trim reduces Capital INR only when `trimCapitalShouldReduce` is true (every sell accepted).
- A Chase square-off without `instrument` resets the signal on every flat Chase book. A per-book square-off resets only that book.
- `planChaseSignalReset` runs before any status write. Unknown quantity is a refuse, not a flat book.
- The header checkbox on Daily trend selects the page on screen. **Turn selected off** uses every checked symbol, including other pages.
- Strategy board **Closed today** is round-trips finished today. **Unrealised P&L** is open quantity versus entry, including earlier days on an overnight book. **Realized lifetime** is stored on the position rows. Kite day P&L is none of these. Chase rows show the strategy-wide closed and realized figures only on the first Chase row.
- The board **Switch** column is not one field. Intraday is straddle and strangle enabled. Chase is that book's on/off. Momentum and Daily trend cells that say **Desk on** are Desk → Risk, not the page Engine.

## Guard rails

These already caused a wrong flatten, a wrong save, or a missed reject.

1. A menu item that names one book must send that book. `strategy: "CHASE"` alone is every book.
2. A switch that looks on is not on until the save that owns it returns. Chase book save waits for the server. Momentum and Daily trend page switches stay draft and show `unsavedRuntimeNote` until Save.
3. Symbol off and Remove from the daily-trend list do not sell and do not run the stop. The confirm has to say both.
4. Kill and square-off copy comes from `killDialogNotice` and `flattenOperatorNotice`. Do not invent a second success string in the component.
5. Due today must not be labeled Schedule. The button and the confirm say run now or queue, from `dueSchedulePresentation`.
6. Do not render today's closed P&L, unrealised P&L, and lifetime realized in the same colour under the same short name.

## How to implement a new control

1. Name the effect before writing the button: which rows change, whether an order is sent, whether a stop still runs, and whether the desk is halted.
2. If the effect is wider than the label, change the label. Do not leave "this book", "Pause", or "Accept" on an action that flattens other books, disables a stop, or deletes a list.
3. Put the confirm and the result sentence in `lib/operatorActionCopy.ts`. The click handler calls that function.
4. Keep the dialog open until the reply. Pass `outcome` into `ConfirmAction`. Use success only when every affected order was accepted and the write you announced happened.
5. A draft control shows the saved value beside it (`unsavedRuntimeNote`). Enable Send from the saved execution, not the menu.
6. A list filter that hides rows must say what it hides, including a holding that failed and will be sold, or a name that is above the band but is not a buy.
7. Add a unit test that fails if the old sentence or the old scope comes back. Run `yarn unit-test`. If the control places, sizes, or refuses an order, also follow [AGENT_ORDER_SAFETY.md](AGENT_ORDER_SAFETY.md) and run `yarn sim-test`.
8. Update this file when the rule changes. A tooltip on the button is not the rule.
