# CM-Desk UI map

Operator-facing surfaces for the personal Kite desk (2026 layout). Behaviour rules for trading and risk are unchanged from `AGENTS.md` — this document is navigation and presentation only.

**Component patterns** (snackbar, toolbars, tables, drawers, confirms): [UI_COMPONENTS.md](./UI_COMPONENTS.md).

## App shell

- **Status rail** (every page, app bar): mode (MOCK / PAPER ONLY / LIVE), entries (halted / trading off / allowed), alerts count (errors + warnings), IST clock, halt / resume. Data: `GET /api/desk/status`.
- **Sidebar (desktop):** Desk, Risk · Intraday: **Templates**, **Schedules** · Continuous: Chase, Momentum, Daily trend · Ops: Queues (new tab) · Guide, Profile, Log out.
- **Straddle and strangle** are not separate nav items; use **Templates** with the All / Straddle / Strangle filter and **New straddle** / **New strangle**.
- **Mobile bottom nav:** Desk, Templates, Chase, More (opens sidebar).

## Routes

| Route | App bar title | Purpose |
|-------|----------------|---------|
| `/desk?view=now` | Desk | Strategy board, today's jobs, emergency actions, account strip |
| `/desk?view=books&tab=…` | Desk | Positions, orders, trades, sessions (`RecordTable`, position drawer) |
| `/desk?view=why&tab=…` | Desk | Alerts, signals (group repeats), decisions, activity |
| `/desk?view=setup&tab=…` | Desk | Broker reconcile, contracts, lists, maintenance |
| `/risk` | Risk | Limits matrix, execution mode, new entries, sticky save |
| `/templates` | Templates | Master–detail editor; `?type=` and `?id=` optional |
| `/plan` | Schedules | Weekday grid; attach template to clock |
| `/chase` | Chase | Books grid: frozen book column, column chooser, pagination; drawer editor |
| `/momentum`, `/daily-trend` | Same as page | Permission line from desk status + page config |
| `/help`, `/help/[topic]` | Guide | Operator help (revamp vocabulary) |
| `/strat/straddle`, `/strat/strangle` | — | Redirect to `/templates?type=…` |

Legacy `?tab=risk` on Desk redirects to `/risk`. Old desk tabs map to views via `lib/deskNavigation.ts`.

## Confirmations and toasts

- Destructive or live actions use **`ConfirmAction`** (no `window.confirm`).
- Transient success/info uses **notistack** via `useSnackbar().showMessage`.

## Formatting and labels

- Money and P&amp;L: `Figure` + `lib/format.ts` (₹, mono, IST times `HH:mm` / `formatIstDateTime`).
- Vocabulary: `lib/ui/labels.ts` (`labelFor`) for books, strategies, halts — not raw `ATM_STRADDLE` in UI.

## Tests

E2E and unit tests that open templates should use `/templates` (optional `?type=ATM_STRADDLE`). Sidebar must not require separate Straddle/Strangle links.

## Desk view modules

- **`pages/desk.tsx`** — data hooks, confirms, summary tiles chrome.
- **`components/desk/views/*`** — Now, Books, Why, Setup panels.
- **Settings forms** (templates, Chase drawer, Risk limits, Momentum filters) use `FieldRow` / `SettingsFields`; **runtime toolbars** (Daily trend engine) use compact horizontal controls — see [UI_COMPONENTS.md](./UI_COMPONENTS.md).
- **Strategy tables** (Chase, Momentum, Daily trend): `ScrollTable` with horizontal page scroll; column menu in section header; `StrategyTablePagination` (10–100 or All); no nested vertical `maxHeight` on the main grid.
- **Outlined `PageSection` panels** (header band + body) group engine, risk, books, feeds, and tables on strategy pages (`/chase`, `/momentum`, `/daily-trend`, `/risk`, `/templates`, `/plan`, `/profile`) and Desk sub-views (Now board, Books, Why, Setup).
- **Template editor** (`FormSection` on straddle/strangle): same header band as `PageSection`. On `md+`, grid order is Contract | Risk on row 1, Entry | Timing on row 2.
- **Labels:** `labelFor` maps known codes; unknown `SNAKE_CASE` is title-cased via `humanizeCode`.

## Operator features (complete)

| Feature | Where |
|---------|--------|
| Go-live readiness checklist | Desk → Now, `/risk` Execution |
| Alert deep-links | Why → Alerts (code / summary links) |
| Reconciliation story | Setup → Broker summary card |
| Signal explainability | Why → Signals (`signalExplain`, labels) |
| Momentum at scale | `/momentum` column menu, rebalance preview diff |
| Daily trend inline edit | `/daily-trend` row select + inline budget/EMA/buffer; engine/execution compact toolbar |
| Chase books config at a glance | `/chase` Books table (EMA, buffer, protect, offset, open classify); amber = differs from primary enabled index |
| Chase spark chart | Chase drawer, `GET /api/chase-settings/chart` |
| Mobile operator sheet | Bottom nav **More** on small viewports |
| Sessions → trades drill | Books → Sessions row click |
| Simulation UI | Setup → Maintenance (`ALLOW_SIM_UI` in production) |
| Risk what-if notional | `/risk` limits preview while editing |
| Plan/scheduling cleanup | `PlanDash` removed; `DueSchedules` uses `fetchJson` |
| Keyboard shortcuts | `?` dialog; `g` then `d` / `r` |
| ERROR browser notify | Profile toggle (`desk.errorNotify`) |
| Constituent preview | Lists → `POST` preview before bulk accept |

## Keyboard

Press `?` on any page for shortcuts. `g` then `d` opens Desk; `g` then `r` opens Risk (ignored while typing in inputs).

## Mobile

On viewports below `sm`, **More** in the bottom nav opens halt, alerts, emergency, and Chase links.
