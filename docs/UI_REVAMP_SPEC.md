# CM-Desk UI revamp — findings, decisions, and build spec

Audience: the coding agent that will implement the revamp. Read this whole file before you change anything. It is written so you can work through it without asking the operator, and it lists the few decisions that already have defaults (section 15).

Status: review done 17 Oct 2026 against the local stack (`http://127.0.0.1:3000`, MOCK) and production (`https://cmdesk.senneris.in`, live Chase book, read-only observation only). No code was changed by the review.

---

## 0. Ground rules for the implementing agent

1. **This is a UI revamp, not a trading change.** Do not touch order placement, risk evaluation, ledger writes, P&L derivation, Chase/straddle/strangle rules, queues, or migrations, except for the read-only API additions in section 7. If a screen needs a number the API does not already return, add a read-only field; never compute new P&L in the browser.
2. Non-negotiables (from `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*`) still apply:
   - Rupees in the UI and **points** for target P&L stay separate. Never merge them into one figure or one chip.
   - ATM straddle/strangle are 9:20-style; a leftover wing until auto square-off is intended. Do not add UI that "cleans up" leftover wings.
   - Chase can stay overnight. Flatten / SL size comes from the open book, never from configured lots. The UI must never send configured lots as a flatten qty.
   - Halt and Trading disabled still allow flatten and SL. Strategy disabled is fully dark (no flatten either). Labels must say exactly this.
   - Flat rows show unrealized `0` (`Number(qty) === 0`). Sessions Net P&L is closed round-trips that IST day. Win rate is a fraction in the API; render it as a percentage.
   - Timezone Asia/Kolkata everywhere. Yarn Berry 4 (`yarn add`), TypeScript for new files, Biome (`yarn lint`, `yarn format`).
3. **Never hit production** from your work. Use the local Docker stack (`docker compose up -d postgres redis`, `yarn dev`, `MOCK_ORDERS=true`). Do not run anything against `cm-desk-prod`.
4. Ship in the PR order of section 13. Each PR must pass `yarn lint`, `yarn unit-test`, `yarn sim-test`, and (when Postgres is up) `yarn api-test`, `yarn int-test`, `yarn build`, `yarn e2e-test`. Update the e2e selectors listed in section 14.3 in the same PR that changes the label.
5. Do not delete operator-facing explanations; move them (into Help, tooltips, or confirm dialogs). Their content is accurate and the operator relies on it.

---

## 1. Product intent (what the UI is for)

CM-Desk is a **personal strategy desk** for one operator on Zerodha Kite (Nifty, Bank Nifty, FinNifty, Midcap Nifty options and futures, plus cash Momentum and Daily trend). Kite remains the place for charts, order book, depth, and manual execution.

The operator uses CM-Desk to answer, in this order:

1. Is anything live, and can new entries open right now? (mode, halt, trading enabled, per-strategy permission)
2. What does each strategy hold, and what is it worth? (open qty, open mark ₹, closed today ₹, lifetime realized ₹)
3. What went wrong or needs attention? (alerts, rejects, failed jobs)
4. Why did the engine do what it did? (signals, decisions, audit)
5. Occasionally: edit a template, attach a weekday schedule, change Chase books, change risk limits, reconcile with the broker.

Design target: **a calm control panel for strategies and books**. Calm at a glance (colour only when something is abnormal), exact on inspection (aligned figures, units, IST times). Not a trading terminal (no charts, depth, hotkey tickets, blotter mosaics), not a SaaS dashboard (no hero cards, no summaries that hide rows).

---

## 2. Findings (evidence)

IDs are referenced from the specs below. "Local" = 1024×552 laptop window on the MOCK stack. "Prod compact" = 682×700 CSS px window on production (the app's below-`md` layout). Measurements are CSS px from `getBoundingClientRect`.

### 2.1 Trust failures (labels disagree with state)

| ID | Finding | Where | Evidence |
|---|---|---|---|
| F-01 | **No visible LIVE indicator anywhere.** Production has `MOCK_ORDERS=false`, Allow live orders on, Chase Execution = Live, and an open live Chase futures book. The Desk header shows only a green "Armed" chip. Chase page shows a green "Entries allowed" chip. Nothing says LIVE. | Desk header, Chase, every other page | Prod `/api/desk/risk` vs Desk header |
| F-02 | **"Armed" ignores Trading enabled.** Chip logic is `deskHalted ? "Halted" : "Armed"` (`pages/desk.tsx`). With Trading enabled off (quiet `TRADING_DISABLED`), the chip still says "Armed. New entries allowed." | Desk header | Code |
| F-03 | **Status only exists on Desk.** Templates, Schedules, Chase, Momentum, Daily trend show no halt / trading / live state. | All non-Desk pages | Local + prod |
| F-04 | **Two "on" switches per strategy disagree.** Momentum and Daily trend pages show "Strategy on" = on, while Desk → Risk "Strategy enabled" = off for both (production and local). Neither page shows the Risk value. The page switches have the accessible name "on". | `pages/momentum.tsx`, `pages/daily-trend.tsx`, Risk | Local + prod API |
| F-05 | **Loading renders defaults as if they were real values.** Momentum uses `draft ?? data?.config ?? DEFAULT_MOMENTUM_CONFIG`; Daily trend similar. For ~1 s Daily trend shows "Signed out", Strategy on = off, Execution "Report only", send disabled, then flips to on / "Manual send" / enabled amber send. `AppShell` shows "Signed out" while `/api/user` is loading. | Momentum, Daily trend, shell | Local screenshots |
| F-06 | **Chase page does not show what Chase holds.** No LONG/SHORT/AWAITING, qty, avg, mark, contract, or open mark. Prod shows NIFTY "Entries allowed" while that book holds an open live long futures position. `GET /api/chase-settings` does not return status. | `pages/chase.tsx` | Prod |
| F-07 | **Risk "Strategy enabled" off next to "Not halted" on** reads as contradictory; "Not halted" is a double negative whose label flips to "Halted: reason" when unchecked. | `components/desk/RiskControls.tsx` | Local |
| F-08 | **Failures shown as info.** Desk `reconMsg` is always `<Alert severity="info">`, including "Halt failed", "Square off failed", "Clear phantom failed". | `pages/desk.tsx` | Code |
| F-09 | **Alert count differs by place.** Sidebar badge = `errorCount` (2), chip/tab = errors + warnings (3). | Shell vs Desk | Local |

### 2.2 Records hidden by layout

| ID | Finding | Evidence |
|---|---|---|
| F-10 | **The live open position cannot be fully seen on the compact layout.** Prod compact, Desk → Positions, at maximum scroll: pinned block bottom = 423, header row 312–349 (hidden), live NIFTY row 349–468 (mostly hidden), Square off button covered. The page cannot scroll further (doc height 1091, viewport 700). | Prod compact |
| F-11 | Pinned Desk block (chips + 3 tiles + tabs) = ~280 px of 552 at rest and ~190 px while scrolling on a 1024×552 laptop. Only one alert row or two order rows fit. | Local |
| F-12 | Table header rows are not sticky; on Signals the column labels scroll away while the tiles stay pinned. | Local |
| F-13 | Risk page is 3,226 px tall; Save is at y≈3,125, alone at the bottom. Strategy section titles scroll under the pinned block, leaving orphaned "Strategy enabled" / "Not halted" checkboxes with no visible strategy name. | Local |
| F-14 | Template editor is 2,028 px tall. "Run now" at y≈172, "Save template" at y≈1,879, Lots at y≈862. The "sticky" footer is `position: sticky` inside the Save section's own box, so it never sticks. | Local |
| F-15 | Chase table is 1,180 px wide inside a ~1,000 px container; Save / Pause / Reset / Remove icons are off-screen at laptop width. "Square off all Chase books" is the last element on the page (y≈1,151 of 1,252), under a column glossary. | Local + prod |
| F-16 | Kill / Square off all buttons exist only on Desk → Today, which is not the default tab (default is Positions). | Code + local |

### 2.3 Actions that look alike but are not

| ID | Finding |
|---|---|
| F-17 | Positions row: **Square off** (sends a broker order) and **Clear phantom** (ledger-only, no order) are adjacent, both warning colour. |
| F-18 | Today: **Square off all open** is the loudest (amber filled); **Kill all (incl. Chase)** is quieter (red outlined). Severity and loudness are inverted. All three share the same Stop icon. |
| F-19 | **Clear paper book** (destructive ledger maintenance) sits between the Book and Period filters on Positions / Orders / Trades / Decisions. |
| F-20 | Alerts / Signals **Clear today / Clear before today / Clear all** are outlined buttons styled like the filter controls. |
| F-21 | Momentum: **Preview orders** (sends nothing) and **Send rebalance** (sends orders) are the same text-button style. Daily trend: **Evaluate** vs **Evaluate and send** likewise. |
| F-22 | Halt fires immediately with a fixed reason `"Manual halt from desk"`; the operator cannot enter a reason. Resume has a confirm. |
| F-23 | `window.confirm` (native "127.0.0.1 says… OK/Cancel") in Templates (Run now, starters), Momentum, Daily trend, Risk (Reset Chase). Everything else uses `ConfirmDialog`. Kill confirm button label is "Proceed". |
| F-24 | Template header: **Run now** (creates a job that can punch) is a small outlined button next to text buttons Save as starter / Reset starter. Save is 1,700 px away. |
| F-25 | Daily trend row: Edit / Pause / **Delete** icons adjacent with no spacing. Schedules: **Remove** has no confirm and no error handling. |

### 2.4 Input integrity

| ID | Finding |
|---|---|
| F-26 | **Silent coercion.** Typing `0` in Lots becomes `1` (`coerceLots`: `n < 1 → 1`) and Save succeeds with "Template saved". The operator never sees that the value changed. (`validateLots` exists but runs on the already-coerced value.) |
| F-27 | A template run time of 17:46 IST (after market close) is accepted and shown without warning. |
| F-28 | The same time is shown as "05:46 PM" (template TimePicker, 12-hour) and "17:46" (Schedules). |
| F-29 | "Max loss (points)" holds `-18`. It is actually a signed **floor** (`targetPnL`: exit when total points `< trailingMaxLossPoints`; after a profit trail it becomes positive). The label hides that. |

### 2.5 Figures, dates, naming

| ID | Finding |
|---|---|
| F-30 | `money()` in `pages/desk.tsx`: 0–2 decimals, no sign, no ₹. Prod shows figures like `1,234.5`, `-12,345`, `1,23,456.7` side by side (1, 0, and 1 decimals). Daily trend uses fixed 2 decimals. PnL chip uses `₹x.toFixed(2) · y pts`. Three formats. |
| F-31 | Positions / Trades / Sessions P&L columns are uncoloured; Desk tiles are coloured. No `font-variant-numeric` anywhere; figures are proportional IBM Plex Sans. Plex Mono is loaded at weight 500 and used only by the PnL chip. |
| F-32 | Trades: "Entry / Exit qty" and "Avg in / out" compound cells wrap to three lines; Net P&L gets the narrowest column. Orders: "Avg · SL · Lmt" in one left-aligned cell. |
| F-33 | Three date formats: `17/10/2026, 8:05:26 am` (Desk), `2026-10-16` (Daily trend), `19 Oct` (template expiry). Timestamps wrap to two lines in Orders/Trades/Alerts. |
| F-34 | Raw codes shown to the operator: `ATM_STRADDLE`, `MIGRATED`, `MOCK`, `RECONCILED`, `MIDCPNIFTY`, `INDIVIDUAL_LEG_SLM_1X` (as radio value), `SHORT/LONG` for vol type. |
| F-35 | Sessions win rate rendered with `money()` → `0` / `0.5`. |
| F-36 | Flat rows show `Avg 0` (prod `MIDCPNIFTY26OCTFUT`). |
| F-37 | Naming drift: menu "Plan" vs page "Schedules"; menu "Guide" vs route `/help`; app bar "CM-Desk" on Templates/Schedules, "Chase plan" on Chase; Straddle/Momentum share an icon, Chase/Daily trend share an icon; template "ATM Straddle" named like the strategy. |
| F-38 | Job cards: `name`, index, status, strategy heading joined with "·"; P&L hidden until Details is expanded. |

### 2.6 Things that are already right (keep them)

- Confirm dialog **content** is accurate: it says what will and will not happen ("does not send a Kite order", "the position and its stop stay").
- Expiry picker shows rule and resolved date: "Current week expiry · 19 Oct · 2 days".
- Notional preview sentence, e.g. "NIFTY: 1 lot × 65 × ₹24,950 = ₹16,21,750 (65 qty)". Keep this sentence form.
- Desk → Contracts Chase chips: `Lots 1 · Paused · EMA 40 · Buffer 0.2% · Entry offset ₹5 · Indexes NIFTY`. Reuse the pattern for template summaries.
- Chase per-row result messages (`useRowNotices`) and the amber "unsaved" save icon.
- Deep-linkable tabs (`?tab=`), 10 s refresh on Today, IST throughout, Indian digit grouping (`16,21,750`).
- Daily trend pinned left columns and fixed decimals. Help pages read well.

---

## 3. Decisions

### 3.1 Framework: stay on MUI 9, replace the visual system

Keep `@mui/material` 9 and `@mui/x-date-pickers`. Add:

- `react-hook-form` + `zod` + `@hookform/resolvers` for Template editor, Risk, Chase book editor, Momentum/Daily trend config forms (field-level errors, `setFocus` on first error, dirty tracking, navigation guard).
- `@tanstack/react-table` v8 (headless) for every record table (typed column defs, sorting, column pinning, sticky header; rendered with MUI `Table` cells).

### 3.4 Implementation amendments (review — apply with code)

These override earlier paragraphs in this file where they conflict.

| Topic | Rule |
|--------|------|
| Strategy board | **No** `Square off book…` on the combined **Intraday** row (`groupTodayBooks` merges straddle + strangle). Square-off only from Books → Positions, a job row, or a **per Chase book** row menu. |
| Board columns | Intraday / Momentum / Daily trend: **Open** (open position count). Chase rows only: **Qty** (signed `netQty`). |
| Chase board rows | Show a book when `enabled \|\| netQty !== 0 \|\| chaseStatusNeedsManagement(status)` (`lib/chaseUniverse.ts`). |
| Entries chip | Precedence: `deskHalted` → `Halted: {reason}`; else `!tradingEnabled` → `Trading off`; else `Entries allowed`. Per-strategy Desk column: **Disabled — dark** over **Entries paused**. |
| Halt reason popover | Re-post `halt` with a new reason **only when** the operator entered non-whitespace text (empty Save must not call the API — default reason would overwrite the rail). |
| Paper → Live confirm | Copy matches `prepareStrategyGoLive`: archives **that strategy’s** paper positions and paper working orders; **Chase signal reset only when switching Chase**; server still blocks if live/Kite has size. |
| `DeskStatus.market.session` | Full `MarketSessionState` from `lib/marketCalendar.ts` (`PRE_MARKET`, `OPEN`, `POST_MARKET`, `CLOSED`, `WEEKEND`, `HOLIDAY`, `OVERNIGHT`, …). Rail clock suffix uses operator labels (Pre-open, Open, Closed, …). Square-off LIVE note when `session !== "OPEN"`. |
| Mode chip | When `!allowLiveOrders`, tooltip still lists each strategy’s `executionMode` (LIVE strategies visible but blocked). |
| Momentum / Daily trend | Permission line shows **both** Desk execution (`PAPER`/`LIVE` from status) and page execution (`report` / `manual` / `auto`). |
| Status APIs | `GET /api/desk/status` and Chase `status` use ledger + `getChaseStatus` + `presentLedgerPosition` only — **no Kite quote fetch** on poll. |
| Signal group repeats | Collapse key includes **outcome text** (what the engine saw), not only strategy + instrument + kind + outcome code. |
| Schedule (due today) | Class **N** — queues at run time; **no** confirm (inline result only). |
| `labelFor` | Also `EXIT`, `HEDGE`, `OTHER` order purposes; stored flatten displays as Exit (`storedOrderPurpose`). |
| Template editor | Summary + footer sticky; editor **panel scrolls** on short viewports (no hard “zero page scroll at 1440”). |
| Run time / ASO | Hard field error outside 09:15–15:30 on a normal day; **attention** chip when calendar has early close (resolved session times). |
| Unsaved navigation | Pages Router: `router.events` `routeChangeStart` + `beforeunload`; do not rely on react-hook-form blocker alone. |
| One-sprint cut | Does **not** claim F-06 or F-07 without Chase `status` API and `/risk` page. |

Rejected:

- **Mantine 8** (closest alternative): better forms/modals/CSS-modules out of the box, but adopting it means rewriting ~55 components and both date-picker forms, and none of the findings above are caused by MUI. Revisit only for a greenfield rewrite.
- shadcn/ui + Radix + Tailwind 4: assemble-your-own plus a second styling system; high upkeep for a one-operator app; default look is SaaS.
- Ant Design: dense and strong forms, but heavy and admin-dashboard looking.
- Blueprint: built for dense desktop data apps, but weaker React 19 track record and an ops-console look.

### 3.2 Fonts

- UI text: **IBM Plex Sans** (400, 500, 600).
- Figures and identifiers: **IBM Plex Mono** (400, 500). Use for every money / points / qty / price / percentage cell and figure, trading symbols, order ids, codes like `DESK_HALTED`. Do not use Mono for labels or prose.
- Load with `next/font/google` in `pages/_app.tsx` (works in the Pages Router), expose as CSS variables `--font-sans`, `--font-mono`, remove the Google Fonts `<link>` tags. If the Docker build has no network, switch to `next/font/local` with files in `public/fonts/`.
- Set `font-variant-numeric: tabular-nums` on the `figure` typography variants as a belt-and-braces measure.

### 3.3 Layout model (summary; details in section 8)

- **Status rail** in the app bar on every page (mode, new entries, alerts, IST clock + market session, Halt/Resume).
- **Desk** becomes four views: **Now** (default: strategy board, today's jobs, emergency panel, account strip), **Books** (Positions, Orders, Trades, Sessions), **Why** (Alerts, Signals, Decisions, Activity), **Setup** (Broker, Contracts, Lists, Maintenance).
- **Risk** becomes its own page `/risk`.
- Only the view switcher and table headers are sticky. Summary tiles scroll away.
- Row click opens a right-side **record drawer**; the list stays visible.
- Status = chip; book provenance = badge; long explanations = Help / tooltips / confirm bodies.

---

## 4. Design tokens

Create `src/theme.ts` (replace `src/theme.js`; update the import in `pages/_app.tsx`). Put raw tokens in `src/tokens.ts` so non-MUI code (charts never; formatters, tests) can import them.

### 4.1 Colour

```ts
// src/tokens.ts
export const color = {
  bg: { canvas: "#0F1217", surface: "#151A21", raised: "#1B212A", inset: "#0B0E12" },
  border: { subtle: "#232A33", default: "#2A313C", strong: "#3A4350" },
  text: { primary: "#E6EAF0", secondary: "#A3ADBB", disabled: "#6E7787", inverse: "#0F1217" },
  accent: { main: "#7AA2FF", hover: "#94B4FF", subtle: "rgba(122,162,255,0.14)" },
  profit: "#4CC38A",
  loss: "#F47A72",
  attention: { main: "#E3A93B", subtle: "rgba(227,169,59,0.14)", on: "#1A1300" },
  danger: { main: "#C93C37", hover: "#B3322E", subtle: "rgba(201,60,55,0.16)", text: "#F47A72", on: "#FFFFFF" },
  live: { bg: "#E3A93B", fg: "#1A1300" },
  paper: { border: "#3A4350", fg: "#A3ADBB" },
} as const
```

Approximate contrast on `surface`: text.primary ~15:1, text.secondary ~7.7:1, accent ~7:1, profit ~7.9:1, loss ~6.6:1, attention ~8:1, white on danger.main ~5:1. text.disabled ~3.9:1 (disabled only).

Meaning (enforce in code review):

| Colour | Means | Never used for |
|---|---|---|
| accent (blue) | interactive, selected nav, focus ring, primary Save | P&L, state |
| profit / loss | sign of a P&L figure only | chips, buttons, state |
| neutral (no colour) | normal state: entries allowed, engine on, OPEN, FLAT | — |
| attention (amber) | needs a look: trading off, paused, dirty form, actions that send orders (outlined), LIVE badge fill | P&L |
| danger (red) | stopped / failure: halted, ERROR, disabled-dark strategy, Kill actions | P&L (P&L loss uses `loss`, not `danger`) |

Remove the teal primary (`#2dd4bf`): it reads as profit green. Remove the radial-gradient body background and the app bar `backdrop-filter`.

### 4.2 Typography

Base 14 px. Map to MUI variants; add custom variants `figure`, `figureLg`, `code` via module augmentation (`src/theme.ts` declares `TypographyVariants` / `TypographyVariantsOptions` / `TypographyPropsVariantOverrides`).

| Use | Variant | Size / line | Weight | Family |
|---|---|---|---|---|
| Page title | `h1` | 20 / 28 | 600 | Sans |
| Section title | `h2` | 15 / 22 | 600 | Sans |
| Card / group title | `h3` | 13 / 20 | 600 | Sans |
| Body | `body1` | 14 / 20 | 400 | Sans |
| Table text, dense body | `body2` | 13 / 18 | 400 | Sans |
| Field / column label | `overline` (sentence case, no uppercase) | 12 / 16 | 500, `text.secondary` | Sans |
| Caption / helper | `caption` | 12 / 16 | 400 | Sans |
| Table figure | `figure` | 13 / 20 | 400 (500 for totals) | Mono, tabular-nums |
| Board / tile figure | `figureLg` | 15 / 20 | 500 | Mono, tabular-nums |
| Identifier (symbol, order id, code) | `code` | 12.5 / 18 | 400 | Mono |
| Button | `button` | 13 / 20 | 600, no uppercase | Sans |
| Chip | — | 12 / 16 | 600 | Sans |

Every page uses exactly one `h1`. The app bar title is the page title (same string), not "CM-Desk".

### 4.3 Shape, spacing, density, elevation

- Spacing unit 4 px (`theme.spacing(1) = 4`). Page padding 16 px (compact) / 24 px (≥ md). Section gap 16 px. Field gap 12 px.
- Radius: controls 6, panels/cards 8, chips 4. No pills except the status rail chips.
- Elevation: none. Panels = `surface` + 1 px `border.default`. Drawers / dialogs = `raised` + `border.strong`.
- Density defaults (`components.*.defaultProps`): `TextField`, `Select`, `Button`, `IconButton`, `ToggleButton`, `Chip` → `size: "small"`; `Table` → `size: "small"`. Table row height 32, header 32, cell padding `6px 10px`. Input height 32–36.
- Focus: `:focus-visible { outline: 2px solid accent.main; outline-offset: 2px }` on every interactive element including table rows that open drawers. Never remove outlines.
- Disabled: `text.disabled`, transparent background, `border.subtle`; a disabled action must have a tooltip that says why (wrap in `<span>`).
- Danger button (Kill, Halt): `danger.main` fill, white text, hover `danger.hover`, same focus ring.
- Breakpoints stay MUI defaults. Design and verify at 1440×900, 1024×552, 682×700, 390×844.

---

## 5. Formatting rules (`lib/format.ts`, new)

Pure functions, unit-tested in `__tests__/unit/format.test.ts`. Replace every ad-hoc `money()`, `when()`, `toFixed`, `toLocaleString` in pages/components with these.

| Function | Rule | Examples |
|---|---|---|
| `formatInr(v, { sign?: boolean })` | `en-IN` grouping, **always 2 decimals**, true minus `−` (U+2212), `+` only when `sign: true` and > 0, `—` for null/""/NaN. No ₹ in table cells (unit lives in header); `formatInrLabel` adds `₹` for prose/tiles. | `9750` → `9,750.00`; with sign `+9,750.00`; `-12345` → `−12,345.00`; `0` → `0.00` |
| `formatPts(v, { sign })` | 2 decimals, signed when `sign`, suffix only in `formatPtsLabel` (`pts`). | `-18` → `−18.00` |
| `formatQty(v, { signed? })` | integer, en-IN grouping; signed when the column is a net position. | `65`, `−65` |
| `formatPrice(v)` | 2 decimals, en-IN grouping, `—` when 0 and the row is flat (caller passes `flat`). | `24,950.00` |
| `formatPct(fraction, dp=1)` | input is a fraction (0–1). | `0.5` → `50.0%` |
| `formatPctValue(v, dp=2)` | input already in percent (buffer %, SL %). | `0.2` → `0.20%` |
| `formatIstTime(d)` | `HH:mm:ss`, 24 h, Asia/Kolkata. | `08:05:26` |
| `formatIstDateTime(d)` | Today: `HH:mm:ss`. Other days this year: `17 Oct 08:05`. Other years: `17 Oct 2025 08:05`. Tooltip/title always full `17 Oct 2026, 08:05:26 IST`. | |
| `formatIstDate(d)` | `17 Oct 2026` (Sessions, Daily trend close date `16 Oct`). | |
| `formatClockHHmm(d)` | `HH:mm` 24 h for schedule/run/ASO times. | `09:20`, `15:20` |
| `pnlTone(v)` | `"profit" | "loss" | "zero" | "none"`; zero → neutral, never coloured. | |
| `labelFor(code)` | maps codes to operator labels (section 6.2). Unknown codes fall back to the code in `code` style. | |

Figure display rules (the `Figure` component applies them):

- Right-aligned, `figure` variant, tabular-nums.
- P&L figures: sign always shown (`+` / `−`), colour by `pnlTone`, plus an `aria-label` that spells it ("profit 9,750 rupees"). Zero is `0.00` in `text.secondary`.
- Non-P&L figures (cash, exposure, price, qty, notional): no colour, no `+`.
- Units in column headers: `Avg (₹)`, `Unrealized (₹)`, `Max loss floor (pts)`, `Qty`, `Lots`, `Buffer (%)`.
- Points and rupees are never in the same cell. If both exist (job P&L), render two adjacent `Figure`s with their own labels: `₹ +1,234.00` and `pts +12.50`.

---

## 6. Vocabulary

### 6.1 Canonical state labels

One term per concept. Use exactly these strings (keep them in `lib/ui/labels.ts`, unit-test the mapping).

| Concept (source field) | Label when on / normal | Label when off / abnormal | Tone |
|---|---|---|---|
| Process `mockOrders === true` | — | `MOCK — nothing reaches Kite` | attention outline |
| `allowLiveOrders` | `Live allowed` | `Paper only` | LIVE badge / neutral |
| Strategy `executionMode` | `LIVE` badge | `PAPER` badge | live fill / paper outline |
| Desk new entries (`deskHalted`, `tradingEnabled`) | `Entries allowed` | `Trading off` (tradingEnabled=false) / `Halted: {reason}` (deskHalted) | neutral / attention / danger |
| Risk `strategies[k].enabled` | `Desk: enabled` | `Desk: disabled — dark (blocks SL and flatten)` | neutral / danger |
| Risk `strategies[k].halted` | `New entries: allowed` | `New entries: paused{: reason}` (flatten and SL still work) | neutral / attention |
| Chase book `enabled` (Trade) | `Engine on` | `Engine off` (an open book still trails) | neutral / neutral-dim |
| Chase book `paused` | `New entries: allowed` | `New entries: paused` | neutral / attention |
| Momentum / Daily trend `config.active` | `Engine on` | `Engine off` | neutral |
| Chase status (`chase_status.current_status`) | `Long`, `Short` | `Awaiting signal`, `Awaiting long fill`, `Awaiting short fill` | neutral (direction is text, not colour) |
| Position status | `Open` | `Flat` | neutral / dim |

Delete these labels: "Armed", "Not halted", "Strategy on", "Trade" (column header becomes "Engine"), "Entries allowed" as a green chip.

### 6.2 Code → label map (`labelFor`)

| Code | Label |
|---|---|
| `ATM_STRADDLE` | ATM straddle |
| `ATM_STRANGLE` | ATM strangle |
| `CHASE` | Chase |
| `MOMENTUM` | Momentum |
| `DAILY_TREND` | Daily trend |
| `NIFTY` / `BANKNIFTY` / `FINNIFTY` / `MIDCPNIFTY` | Nifty 50 / Bank Nifty / FinNifty / Midcap Nifty |
| `LIVE` / `PAPER` / `MOCK` / `RECONCILED` / `MIGRATED` | Live / Paper / Mock / Reconciled / Migrated (as `BookBadge`) |
| `SHORT` (vol type) | Sell premium (short) |
| `LONG` (vol type) | Buy premium (long) |
| `MIS` / `NRML` | MIS (intraday) / NRML (carry) |
| `INDIVIDUAL_LEG_SLM_1X` | Fixed SL % per leg |
| `NO_SL` | No stop-loss |
| Order `purpose` `ENTRY` / `SQUARE_OFF` / `SL` / `EXIT` / `HEDGE` / `OTHER` | Entry / Square off / Stop-loss / Exit / Hedge / Other (flatten stored as Exit) |

Trading symbols (`NIFTY26OCTFUT`) stay as-is in `code` style. Indexes in pickers use the label with the code as secondary text (`Midcap Nifty · MIDCPNIFTY`).

### 6.3 Navigation names

Sidebar (desktop) groups and items, with **unique** icons:

- Desk (`SpaceDashboardOutlined`) — badge = errors + warnings (same number everywhere)
- Risk (`ShieldOutlined`)
- **Intraday**: Templates (`DescriptionOutlined`), Schedules (`CalendarMonthOutlined`)
- **Continuous**: Chase (`AllInclusiveOutlined`), Momentum (`TrendingUpOutlined`), Daily trend (`ShowChartOutlined`)
- **Ops**: Help (`MenuBookOutlined`), Queues (`HubOutlined`, opens `/queues` in a new tab), Profile, Log out

"Straddle" / "Strangle" sidebar entries are removed; Templates has its own type filter. Bottom navigation (compact): Desk, Templates, Chase, More.

---

## 7. Read-only API additions

No writes, no schema changes, no change to existing response fields (add fields only).

### 7.1 `GET /api/desk/status` (new, `pages/api/desk/status.ts`)

Aggregates what the status rail and every strategy page need. Reuse existing helpers (`getRiskSettings`-equivalent used by `/api/desk/risk`, alert summary used by `/api/desk/alerts?summary=1`, `lib/marketCalendar` / clock).

```ts
type DeskStatus = {
  serverTimeIst: string            // ISO
  market: { session: MarketSessionState; nextChangeIst: string | null; isTradingDay: boolean }  // lib/marketCalendar.ts
  mockOrders: boolean
  allowLiveOrders: boolean
  tradingEnabled: boolean
  deskHalted: boolean
  haltReason: string | null
  strategies: Record<RiskStrategyKey, {
    enabled: boolean
    halted: boolean
    haltReason: string | null
    executionMode: "PAPER" | "LIVE"
    openPositions: number          // count of OPEN ledger rows for that strategy and active book
  }>
  alerts: { errorCount: number; warnCount: number }   // same window as the Desk badge
}
```

Auth: same session check as other desk routes. Poll every 10 s with SWR; revalidate on focus.

### 7.2 `GET /api/chase-settings` — add `status` per book

Extend each element of `books[]` with:

```ts
status: {
  current: "LONG" | "SHORT" | "AWAITING_LONG" | "AWAITING_SHORT" | "AWAITING_SIGNAL" | null
  tradingsymbol: string | null
  stoploss: number | null
  entryPoint: number | null
  netQty: number                 // from the active-book ledger position (presentLedgerPosition / signedQty)
  averagePrice: string | null
  markPrice: string | null
  unrealizedPnl: string          // "0" when netQty === 0
  provenance: "LIVE" | "PAPER" | "MOCK" | "RECONCILED" | null
  frontFuture: string | null     // from the instrument cache already used by Desk → Contracts
  nextRolloverIst: string | null // 15:00 IST on expiry day of the front future
} | null
```

Use `getChaseStatus(instrument)` (`lib/drizzleDbUtils.ts`) and the same ledger position read that Desk → Positions uses (`presentLedgerPosition` / `signedQty`). Unrealized for a flat book is `"0"`. Do not call Kite for marks on this endpoint.

### 7.3 Momentum / Daily trend

No new endpoint; those pages read `/api/desk/status` for the Desk permission line.

### 7.4 Halt reason

`POST /api/desk/risk { action: "halt", reason }` already accepts `reason`. UI change only.

Add API contract tests in `__tests__/api/` for 7.1 and 7.2 (shape, auth, flat book unrealized `"0"`, no writes).

---

## 8. Screen specs

Wireframes are schematic; sizes are for 1440×900 unless stated. Every screen must also pass the compact checks in 8.12.

### 8.1 App shell (`components/AppShell.tsx`, `components/Layout.tsx`)

```
┌ sidebar 232px ┐┌ app bar 48px ────────────────────────────────────────────────────────────┐
│ CM-DESK       ││ Desk        [LIVE · Chase] [Entries allowed] [Alerts 1] 09:41:07 IST · Open  [Halt new entries] │
│ Desk      (1) │└──────────────────────────────────────────────────────────────────────────┘
│ Risk          │  page content (max-width 1400, padding 24)
│ Intraday      │
│  Templates    │
│  Schedules    │
│ Continuous    │
│  Chase        │
│  Momentum     │
│  Daily trend  │
│ Ops           │
│  Help         │
│  Queues ↗     │
│ ───────────── │
│ S. Subramanian│
│ Profile · Log out
└───────────────┘
```

Status rail (`components/shell/StatusRail.tsx`), left to right, fed by `/api/desk/status`:

1. **Mode chip**
   - `mockOrders` → `MOCK` (attention outline). Tooltip: "MOCK_ORDERS=true on this process. Nothing reaches Kite, whatever the Risk settings say."
   - else `!allowLiveOrders` → `PAPER ONLY` (paper outline). Tooltip lists each strategy’s execution mode (LIVE strategies still shown).
   - else if any strategy `executionMode === "LIVE"` → `LIVE · {comma list of live strategies}` (live fill: amber background, dark text, dot icon). Tooltip lists each strategy's mode.
   - else `LIVE ALLOWED · all strategies paper` (paper outline).
2. **Entries chip** (evaluate in order): `Halted: {reason}` (danger) if `deskHalted`; else `Trading off` (attention) if `!tradingEnabled`; else `Entries allowed` (neutral). Click → `/risk`.
3. **Alerts chip**: `Alerts {errors+warnings}`; danger tone if errors > 0, attention if only warnings, neutral "No alerts" otherwise. Click → `/desk?view=why&tab=alerts`.
4. **Clock**: `HH:mm:ss IST · {Pre-open | Open | Closed}` (client clock offset-corrected from `serverTimeIst`).
5. **Halt / Resume** (fixed right):
   - Not halted: danger-filled button `Halt new entries`. One click halts immediately (no confirm; halting is the safe direction) with reason `"Halted from status rail"`, then opens a small popover anchored to the rail with a reason text field ("Why? (optional)") and Save. Save re-posts `halt` **only if** the field has non-whitespace text.
   - Halted: attention-outlined `Resume…` → `ConfirmAction` (existing resume copy, plus "This also turns Trading enabled back on.").
   - Tooltip on Halt: "Stops new entries desk-wide with a stored reason. Flatten and stop-loss still work."

Loading: while `/api/user` or `/api/desk/status` is loading, render skeleton chips (`Skeleton` width 96) — never "Signed out", never "Entries allowed" (F-05). On fetch error, render a danger chip `Status unavailable` with retry.

Compact (< md): app bar shows page title + Mode chip + Entries chip + Halt icon button (danger, `aria-label="Halt new entries"`); Alerts and clock move into a second 32 px row that scrolls away with the page. Bottom navigation unchanged (Desk, Templates, Chase, More).

The user chip moves out of the app bar into the sidebar footer.

### 8.2 Desk (`pages/desk.tsx` → split)

Split the 1,160-line page into `pages/desk.tsx` (router + view switch) and `components/desk/views/{NowView,BooksView,WhyView,SetupView}.tsx`. Data hooks move to `lib/hooks/useDesk*.ts`.

URL: `/desk?view=now|books|why|setup&tab=…`. Back-compat redirect (client `router.replace`, shallow) for old `?tab=`:

| Old `tab` | New |
|---|---|
| (none) | `view=now` |
| `today` | `view=now` |
| `positions`, `orders`, `trades`, `sessions` | `view=books&tab=<same>` |
| `alerts`, `signals`, `decisions`, `activity` | `view=why&tab=<same>` |
| `lists`, `contracts`, `broker` | `view=setup&tab=<same>` |
| `risk` | `/risk` |
| `plan` | `/plan` (existing) |

Header: `h1` "Desk" only. Remove the description paragraph (moves to Help). The Halt button moves to the status rail. Sticky element: the view switcher row only (`ToggleButtonGroup`: Now · Books · Why · Setup, plus the sub-tabs for that view on the same row when width allows). Height ≤ 44 px. Tiles are not sticky.

#### 8.2.1 Now view (default)

Order on the page:

**A. Strategy board** (`components/desk/StrategyBoard.tsx`), one table, rows:

- Intraday (straddle + strangle, the existing `today` group `intraday`)
- Chase · {each book with `enabled`, `netQty ≠ 0`, or `chaseStatusNeedsManagement(status)`}
- Momentum
- Daily trend

| Column | Source | Format |
|---|---|---|
| Strategy | label | body2; Chase rows show index label |
| State | Chase: `status.current`; others: `Open n` / `Flat` from `today[].open` | chip (neutral) |
| Desk | `/api/desk/status` strategies | `Enabled` / `Disabled — dark` (danger, wins over paused) / `Entries paused` (attention) |
| Mode | executionMode + process mode | `BookBadge` LIVE/PAPER/MOCK |
| Open / Qty | Intraday, Momentum, Daily: `today[].open` (count), header **Open**. Chase: `status.netQty`, header **Qty**, signed figure |
| Open mark (₹) | `today[].openMark` (Chase per book: `status.unrealizedPnl`) | P&L figure |
| Closed today (₹) | `today[].closedToday` | P&L figure |
| Realized lifetime (₹) | `portfolio.strategyPnl[].realized` (grouped as today) | P&L figure; header tooltip "Lifetime realized on the books. Not today, not Kite day P&L." |
| Engine | Chase `enabled`, Momentum/Daily `config.active` (fetch lazily) | `Engine on/off` text |
| | actions | `⋯` menu: Open page. **Chase rows only:** `Square off book…` when `netQty ≠ 0` and strategy not Desk-disabled (class "Sends order"). **No** square-off on the Intraday combined row. |

Do not add a "total" row that sums rupees across strategies with different meanings. Do not show points here.

Row click → record drawer with that strategy's open positions, today's orders, last 10 decisions/signals.

**B. Today's jobs** (`components/desk/TodayJobs.tsx`, replaces `DueSchedules` + `TradesForDay` cards):

- "Due today" rows (not yet queued): `HH:mm` · template name · strategy label · index label · button `Schedule` (attention outlined, class "Queues a job").
- Job rows: `HH:mm` (runAt) | Template (name) | Strategy | Index | Status chip (`Queued`, `Waiting skew`, `Open`, `Stopped`, `Failed: {operatorJobError}` in danger) | P&L (₹) figure | P&L (pts) figure | actions: `Details` (opens drawer with existing `TradeDetails` + `BrokerOrders`), `Square off…` (when `dashboardJobActions.showSquareOff`), `⋯` → `Delete job` (when `showDelete`).
- Keep 10 s refresh.
- Empty: "Nothing scheduled today." + link buttons `Schedules` and `New template`. One line, no hero card.

**C. Emergency panel** (`components/desk/EmergencyPanel.tsx`), always rendered on Now (even when there are no jobs), bordered `danger.subtle`:

| Button | Style | Confirm title | Confirm label |
|---|---|---|---|
| Square off all open books | attention outlined, icon `CallMissedOutgoing` | "Square off every open book?" | `Square off all` |
| Kill intraday | danger outlined, icon `StopCircleOutlined` | "Kill today's straddles and strangles and halt the desk?" | `Kill intraday` |
| Kill all (incl. Chase) | danger filled, icon `Block` | "Kill every job, pause Chase, and halt the desk?" | `Kill all` |

Confirm bodies reuse `KILL_MESSAGES` text, restructured as "Will:" / "Will not:" bullet lists, plus a live summary line: "Open now: Chase · NIFTY Long 65 (LIVE); …" from the board data. Default focus on Cancel for the two Kill actions.

**D. Account strip** (collapsed by default, `Account` disclosure): Cash, Portfolio, Gross exposure, Drawdown, Realized (all), Unrealized (all) as label/figure pairs in one row (wraps on compact). Non-P&L figures neutral; Realized/Unrealized coloured.

#### 8.2.2 Books view

Sub-tabs: Positions · Orders · Trades · Sessions. Toolbar (left to right): Book filter, Period (not on Positions), search box (symbol), right-aligned `⋯` → `Maintenance ▸ Clear paper book…` (moves out of the filter row, F-19; also available in Setup → Maintenance).

Book filter labels (keep the existing API params):

- Positions: `Live` (`LIVE`), `Live + reconciled` (`WITH_RECON`), `Paper / mock` (`PAPER`)
- Orders/Trades: `All books` (`ALL`), `Live + reconciled` (`LIVE`), `Paper / mock` (`PAPER`)

All tables: TanStack + `components/records/RecordTable.tsx`, sticky header, first column pinned, horizontal scroll inside the table container (not the page), row height 32, row click → drawer, empty / loading / error states from 10.4.

**Positions** columns:

| Column | Type | Notes |
|---|---|---|
| Symbol | code, pinned | |
| Strategy | label | |
| Book | `BookBadge` | |
| Product | text | MIS/NRML |
| Qty | qty signed | |
| Avg (₹) | price | `—` when flat and avg 0 (F-36) |
| Mark (₹) | price | |
| Unrealized (₹) | P&L | forced `0.00` when qty 0 (keep existing rule) |
| Realized lifetime (₹) | P&L | header tooltip |
| Status | chip `Open`/`Flat` | flat rows: `text.secondary` |
| Actions | | `Square off {qty}…` attention outlined (only `OPEN`, qty ≠ 0); `⋯` → `Clear phantom row…` (ledger-only) |

Sort: Open first, then strategy, then symbol. Footer note removed (moves into the two confirm dialogs and Help).

Square off confirm: title "Square off {symbol} {qty} ({Book})?" Body: existing copy as bullets. Confirm label `Square off {qty}`. For LIVE book, show the LIVE badge in the dialog title and add "Market closed: a live book is refused; the position and its stop stay." when `market.session !== "OPEN"`.

Clear phantom confirm: title "Clear the ledger row for {symbol}?" Body starts with **"This does not send a Kite order."** Confirm label `Clear ledger row` (neutral/danger-text style, not amber).

**Orders** columns: When (IST) | Status | Side | Symbol | Filled | Requested | Avg (₹) | Trigger (₹) | Limit (₹) | Type | Purpose | Book | Reason | Tag | Broker id (code, copy button). `Filled at` lives in the drawer. Reason truncates with tooltip.

**Trades** columns: Entry (IST) | Exit (IST) | Symbol | Dir | Strategy | Book | Entry qty | Exit qty | Avg in (₹) | Avg out (₹) | Net P&L (₹) | Exit reason | Status. Net P&L min width 112.

**Sessions** columns: Date (IST) | Net P&L (₹) | Fees (₹) | Trades | Wins | Win rate | Max drawdown (₹). Win rate via `formatPct`. Caption under the table: "Net P&L = closed round-trips whose exit is on that IST date. Open Chase mark is not included. Not Kite day P&L."

#### 8.2.3 Why view

Sub-tabs: Alerts · Signals · Decisions · Activity. Shared Period control.

- **Alerts**: When (IST) | Severity chip (icon + word: `Error` danger, `Warning` attention, `Info` neutral) | Source | What happened | Strategy (label) | Instrument | Code (code style, last column). Summary line above: "{n} errors · {m} warnings in this period". Clear actions move to `⋯` → `Hide alerts ▸ Today… / Before today… / All…` (existing `ConfirmDialog` copy, confirm label `Hide`).
- **Signals**: When | Outcome chip | Kind | What the engine saw | Strategy | Instrument | Trade. Add a toggle `Group repeats` (default on): consecutive rows with the same strategy + instrument + kind + outcome + outcome text collapse into one row "×{n} · {first}–{last}" that expands on click. Clear actions → `⋯` menu, confirm label `Delete signals`.
- **Decisions**: When | Action | Strategy | Symbol | Book | Risk result (chip; rejects attention) | Reason.
- **Activity**: two tables (Audit, Reconciliation) as today, with RecordTable.

#### 8.2.4 Setup view

Sub-tabs: Broker · Contracts · Lists · Maintenance.

- Broker: existing Reconcile + `StrategyReconcile`, results inline under the button (success neutral, failure danger, never info).
- Contracts: as today (it already works well).
- Lists: as today.
- Maintenance (new grouping): `Clear paper book…`, `Reset all Chase books to a fresh signal…` (moved from Risk), each a neutral outlined button with a one-line description and its existing confirm text. Header line: "Ledger maintenance. None of these send a Kite order."

### 8.3 Risk (`pages/risk.tsx`, new; `components/desk/RiskControls.tsx` rewritten)

Form with react-hook-form; one Save for everything except immediate actions.

```
Risk                                                         [status rail]
┌ Execution ─────────────────────────────────────────────────────────────┐
│ Process        MOCK_ORDERS=false (read-only, set in .env)              │
│ Allow live orders  [switch]  → LIVE badge when on                      │
└────────────────────────────────────────────────────────────────────────┘
┌ New entries (desk) ────────────────────────────────────────────────────┐
│ Now: Entries allowed | Trading off | Halted: reason   [Resume…]        │
│ Trading enabled [switch]   quiet config; flatten and SL still work     │
│ Reject new entries when the cash market is closed [checkbox]           │
└────────────────────────────────────────────────────────────────────────┘
┌ Limits ────────────────────────────────────────────────────────────────┐
│ Max qty / order [   ] Max notional (₹) [   ] Max working orders [   ]   │
│ Max orders / min [  ] Stale price max age (s) [  ] Minimum LTP (₹) [  ] │
│ Notional check: Chase NIFTY 1 × 65 × ₹24,950 = ₹16,21,750  ✓ under cap  │
└────────────────────────────────────────────────────────────────────────┘
┌ Strategies ────────────────────────────────────────────────────────────┐
│ Strategy     Desk permission     New entries      Execution  Max lots  Max open │
│ ATM straddle [on]  Enabled       [on] Allowed     PAPER|LIVE [200]     [12]     │
│ Chase        [on]  Enabled       [on] Allowed     PAPER|LIVE [200]     [12]     │
│ Momentum     [off] Disabled—dark [on] Allowed     PAPER|LIVE  —        [40]     │
└────────────────────────────────────────────────────────────────────────┘
┌ sticky footer ─────────────────────────────────────────────────────────┐
│ 3 unsaved changes    [Discard]                    [Save risk limits]   │
└────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Strategy matrix is a table (one row per `RISK_STRATEGY_KEYS`). Desk permission switch off renders the row label `Disabled — dark (blocks SL and flatten)` in danger. New entries switch is `checked = !halted`; when off, an inline reason field appears (stored in `haltReason`).
- Execution is a `ToggleButtonGroup` PAPER | LIVE. Choosing LIVE shows the existing Live warning inline under the row (not as a full-width alert above).
- Max lots hidden for Momentum / Daily trend (as today).
- **Guards on Save** (client-side confirms; server still validates):
  - Any strategy Desk permission on → off while that strategy has open qty (`/api/desk/status` `openPositions > 0`): confirm "Disabling {strategy} blocks its stop-loss and flatten while {n} position(s) are open. Continue?" confirm label `Disable anyway`.
  - Any PAPER → LIVE: confirm listing consequences from `prepareStrategyGoLive` (archives **that strategy’s** paper positions and paper working orders; resets Chase signal state **only when switching Chase**; needs MOCK_ORDERS=false and Allow live; blocked if live/Kite still has size).
  - Allow live orders off → on: confirm "Live orders can reach Kite for strategies set to LIVE: {list}."
- Save errors: show in the sticky footer (danger) and mark the field when the server error names one.
- Unsaved-changes guard: `router.events` `routeChangeStart` (Pages Router) and `beforeunload`.
- Remove the opening paragraph and the MOCK alert; the Execution section shows process mode read-only.
- `/desk?tab=risk` redirects here.

### 8.4 Templates (`pages/templates.tsx`, `components/trades/atmStraddle/TradeSetupForm.tsx`, `components/trades/atmStrangle/TradeSetupForm.tsx`, `components/lib/*Component.tsx`)

Master-detail.

```
Templates            [All | Straddle | Strangle]          [New straddle] [New strangle]
┌ list 300px ────────────────┐┌ editor ───────────────────────────────────────────────┐
│ ATM Straddle               ││ Editing "ATM Straddle"                       [⋯]       │
│ Straddle · Nifty 50        ││ Nifty 50 · ATM straddle · Sell premium · MIS ·         │
│ Weekly current · 09:20     ││ Weekly current (19 Oct) · 2 lots = 260 qty ·           │
│ M T W T F  (M,T,F filled)  ││ SL 30% per leg · Loss floor −18 pts · Target 12 pts    │
│────────────────────────────││ (+10% trail) · ASO 15:20 · Runs 09:20                  │
│ 2                          ││────────────────────────────────────────────────────────│
│ Straddle · Nifty 50 …      ││ Contract │ Entry                                       │
└────────────────────────────┘│ Exits    │ Timing                                      │
                              │────────────────────────────────────────────────────────│
                              │ sticky: 2 fields need attention  [Run now…] [Cancel] [Save template] │
                              └────────────────────────────────────────────────────────┘
```

List (`components/templates/TemplateList.tsx`): rows, not buttons. Each row: name (600), strategy label · index label, expiry rule short + run time `HH:mm`, weekday chips M T W T F (filled where a schedule exists, from `/api/templates` `schedules`). Selected row = accent left border + `accent.subtle` background. Keyboard: ↑/↓ moves selection, Enter opens. Type filter is a `ToggleButtonGroup` bound to `?type=`.

Editor:

1. **Summary line** (`components/templates/TemplateSummary.tsx`), sticky at the top of the editor panel, rendered from the **current form values** (not the saved ones), chip-separated like Contracts. Changed-but-unsaved parts are underlined in attention. Content: index · strategy · vol type · product · expiry rule (resolved date) · lots = qty (lots × lot size × legs, from `lotSizeForInstrument`) · SL · loss floor pts · target pts (+trail) · hedge · ASO time · run time. Rupees appear only in the notional preview, never in this line next to points.
2. **Sections** in a two-column grid at ≥ 1280 px (Contract | Entry on the first row, Exits | Timing on the second), one column below. Field rows use label-left layout (`FieldRow`: 160 px label, input 160–240 px, helper under the input). Target: summary and sticky footer always visible; field grid scrolls inside the editor panel on short viewports (e.g. 1024×552).
   - Contract: Template name; Index (`ToggleButtonGroup`, labels from 6.2); Vol type (Sell premium / Buy premium); Product (MIS / NRML); Option expiry (keep `ExpiryTypeComponent` resolved dates); Lots + per-index lots; notional preview (keep sentence form).
   - Entry: Ideal skew (%), Threshold skew (%), Skew checker (min), If skew never converges (Reject / Enter anyway).
   - Exits: Exit mode (Fixed SL % per leg / No stop-loss) + SL (%); Add OTM hedge + distance; **Loss floor (pts)** — signed number input, helper "Exit when combined points fall below this. Usually negative (e.g. −18). After a profit trail it moves up." (F-29; do not change stored sign); Profit target (pts) + Trail-up (%).
   - Timing: Auto square off + time; Rollback (3 checkboxes); Run time.
   - Conditional fields stay in place when their toggle is off, rendered disabled with the value shown and "(off)" in the label, so the layout does not jump and every parameter stays visible.
3. **Time pickers**: `ampm={false}`, format `HH:mm`, IST. Validate run time and ASO within 09:15–15:30 IST on trading days; outside → field error "Outside market hours (09:15–15:30 IST)" (F-27). ASO must be after run time.
4. **Validation** (zod schema `lib/forms/templateSchema.ts`): Lots integer ≥ 1 and ≤ Risk `maxLots` for that strategy; skew % 0–100; SL % 0–100; times as above; name required and unique (server). **Remove silent coercion from the form path** (F-26): keep the raw string in form state, validate, and show the error; call `coerceLots` only in the API mapper as today. Validate on blur and on submit, not on every keystroke.
5. **Sticky footer** (`FormShell`): left: error summary "2 fields need attention" (clicking focuses the first invalid field via `setFocus` and scrolls it into view) or "Unsaved changes" (attention) or nothing; right: `Run now…` (attention outlined, class "Queues a job"), `Cancel`, `Save template` (accent filled). `⋯` menu in the editor header: `Save as starter…`, `Reset starter…` (`ConfirmAction`, existing copy).
6. **Run now** confirm: title "Create today's job from this form?" body = the summary line + "The template is not saved." + market-closed note when closed. Confirm label `Create job`. On success navigate to `/desk?view=now`.
7. Save result: success toast near the footer "Template saved. Existing jobs were not changed." (5 s); server error in the footer (danger) and on the field when identifiable.
8. Unsaved-changes guard when switching templates, changing type filter, or navigating away.

Both straddle and strangle forms share `FormShell`, `FieldRow`, `TemplateSummary`, and the section components; strangle adds its strike fields in Entry.

### 8.5 Schedules (`pages/plan.tsx`)

Route stays `/plan`; title, nav, and app bar say "Schedules".

```
Schedules                                     Template [select ▾]  Weekday [Mon ▾]  [Attach]
┌ Mon ─────┐┌ Tue ─────┐┌ Wed ─────┐┌ Thu ─────┐┌ Fri ─────┐
│ 09:20    ││ 09:20    ││          ││          ││ 09:20    │
│ ATM Str. ││ ATM Str. ││  Nothing ││  Nothing ││ ATM Str. │
│ Nifty 50 ││ Nifty 50 ││          ││          ││ Nifty 50 │
│ Straddle ││ Straddle ││   [+]    ││   [+]    ││ Straddle │
│ [⋯]      ││ [⋯]      ││          ││          ││ [⋯]      │
└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘
```

- Five columns ≥ md; stacked days on compact. Days labelled `Mon … Fri` (not uppercase codes). Today's column has an accent top border.
- Card: run time `HH:mm` (figure), template name, index label, strategy label, `Paused` chip when `enabled=false`. Card click → `/templates?id=…`.
- `⋯` → `Open template`, `Remove from {day}…` (confirm "Remove {name} from {day}? The template stays." label `Remove`; errors shown on the card).
- Run time outside market hours → attention chip "Outside market hours".
- `[+]` in an empty column opens the Attach control pre-set to that weekday.

### 8.6 Chase (`pages/chase.tsx`)

```
Chase                                                     [Square off all Chase books…]
Futures trend-follow on hourly EMA. Overnight allowed. Rolls front month 15:00 IST on expiry.
┌ Book ────────┬ State ─────────┬ Mode ┬ Qty ┬ Avg (₹) ┬ Mark (₹) ┬ Open mark (₹) ┬ Contract ─────┬ Rollover ┬ Engine ┬ New entries ┬ Lots ┬ ⋯ ┐
│ Nifty 50     │ Long · SL 24,600│ LIVE │  65 │ 24,800.00│ 24,950.00│  +9,750.00   │ NIFTY26OCTFUT │ 28 Oct 15:00│ On │ Allowed     │ 1    │ ⋯ │
│ Bank Nifty   │ Awaiting signal │ LIVE │  0  │   —     │    —     │   0.00       │ BANKNIFTY26OCTFUT│ …     │ Off│ Allowed     │ 1    │ ⋯ │
└──────────────┴────────────────┴──────┴─────┴─────────┴──────────┴──────────────┴───────────────┴──────────┴────────┴─────────────┴──────┴───┘
[ Add underlying: search …  ]
Notional: NIFTY 1 lot × 65 × ₹24,950 = ₹16,21,750 (65 qty). Desk max notional ₹{cap}.
(All figures in wireframes are illustrative.)
```

- Table is **read-first**: state and book from `status` (section 7.2); config columns show values, not inputs. Row click or `⋯ → Edit book…` opens a right drawer with the editable fields (Lots, EMA, Buffer %, Protect %, Entry offset (₹), 09:16 classify) in a react-hook-form with Save / Cancel and inline errors. Help text per field from `CHASE_COLUMN_NOTES` becomes the field helper text.
- Engine switch and New entries (Pause) stay as immediate actions in the row (they save immediately today); each shows a row notice on result (keep `useRowNotices`). Pause disabled when Engine off, with tooltip "Turn the engine on first."
- `⋯` row menu: `Edit book…`, `Square off this book…` (only when netQty ≠ 0; sends order; confirm shows qty from `status.netQty` and book), `Reset to fresh signal…` (existing confirm), `Remove book…` (existing confirm; disabled with tooltip while open or awaiting fill).
- Header action `Square off all Chase books…` (attention outlined) top-right; existing confirm copy.
- Desk permission line under the title from `/api/desk/status`: e.g. "Desk: enabled · Execution LIVE · New entries allowed". If Desk disabled: danger banner "Chase is disabled on Desk → Risk. Orders are rejected, including stop-loss and flatten." with link to `/risk`.
- Column glossary block removed from the page; it lives in Help (`/help/chase`) and in drawer helper text.
- Fits 1024 px without horizontal page scroll: pin Book column; hide Avg / Mark below 1280 (available in the drawer).

### 8.7 Momentum (`pages/momentum.tsx`)

- Header: `h1` "Momentum" + Guide link. Under it, a **permission line** from `/api/desk/status` and config: `Engine on · Desk: … · Book: PAPER|LIVE · Page execution: Report only|Manual send|Auto · Rebalance: …`. If Desk disabled while Engine on: attention banner "Engine is on, but Momentum is disabled on Desk → Risk, so no order will be accepted." link `/risk` (F-04).
- Loading: render `Skeleton` blocks for the config panel until `data` arrives; never render `DEFAULT_MOMENTUM_CONFIG` as if it were stored (F-05). Implementation: `const config = draft ?? data?.config` and gate the form on `data`.
- Config panel with react-hook-form and a sticky footer (Unsaved changes · Discard · Save). Switch labels: `Engine on`, `Pull data daily`; switches get proper accessible names (`inputProps={{ "aria-label": … }}` / `FormControlLabel`).
- Action row, separated by class:
  - Neutral: `Pull history now`, `Retry missing`, `Preview orders` ("sends nothing" in tooltip).
  - Sends orders: `Send rebalance…` attention outlined, separated by a divider, `ConfirmAction` with the preview summary (n buys, n sells, ₹ total), confirm label `Send {n} orders`.
- Drift cash actions keep their confirms but use `ConfirmAction` (labels `Buy spare cash…`, `Trim {p}%…`).
- Table: Figures via `Figure`; dates via `formatIstDate`.

### 8.8 Daily trend (`pages/daily-trend.tsx`)

Same pattern as Momentum:

- Permission line + banner (F-04), skeleton loading (F-05), sticky save for the runtime config.
- Actions: neutral `Pull history now`, `Retry missing`, `Evaluate`; sends orders `Evaluate and send…` (attention outlined, confirm with the would-send list).
- Bulk: `Apply to all…`, `Turn all on…`, `Turn all off…` via `ConfirmAction` (existing copy).
- Table: Close column shows the price figure and the date as a tooltip / secondary caption `16 Oct` (no ISO). Row icons: `Engine` switch, `Edit`, `Pause/Resume`, then 8 px gap and `⋯` containing `Remove…` (no bare delete icon next to pause, F-25).
- Move the long caption into Help and column header tooltips; keep one line: "Close = last completed session. Stop shows once long."

### 8.9 Help (`pages/help/*`)

- Keep content. Add a right-hand "On this page" list of section anchors at ≥ lg.
- Topic switcher as a vertical list at ≥ md instead of wrapped buttons.
- Update copy that names removed labels ("Armed", "Not halted", "Strategy on", "Trade", tab names) to the vocabulary in section 6. Update `lib/helpContent.ts` and its unit test.
- New section `/help/desk#status-rail` explaining the four rail chips and Halt vs Trading off vs Desk disabled vs Engine off (table from 6.1).

### 8.10 Login, Profile

- Login: keep layout; switch to new tokens; replace the "Local Docker uses HTTP cookies…" sentence with a caption only when `NODE_ENV !== "production"`.
- Profile: tokens only.

### 8.11 Shared feedback surfaces

Replace the three systems (Desk `reconMsg` Alert, `useSnackbar`, `useActionNotice`) with:

- **Inline result** next to the control that caused it (row notice, footer message, section message). Success/info auto-hide after 5 s; errors persist until dismissed or the control is used again.
- **Toast** (`notistack`-style via MUI `Snackbar`, bottom-left) only for results of actions whose control disappears (dialog confirm, drawer close). Errors as toasts persist and use danger tone.
- Never use `severity="info"` for a failure (F-08).

### 8.12 Compact layout checks (< md, verify at 682×700 and 390×844)

- No sticky element taller than 56 px besides the app bar (48 px). The live open position row and its Square off button must be fully visible after scrolling on Desk → Books → Positions with 1, 5, and 20 positions (F-10).
- Records render as tables with horizontal scroll inside the container and the first column pinned; do not convert to cards (operators compare columns).
- Status rail compact form per 8.1.

---

## 9. Action catalogue

Every operator action, its class, placement, and confirmation. Classes:

- **N** navigate/view (text button or link)
- **S** save config (accent filled, in a sticky footer)
- **T** immediate config toggle (switch, saves on change, inline row result)
- **L** ledger-only maintenance (neutral outlined, usually in a `⋯` menu, confirm body starts "This does not send a Kite order.")
- **O** sends or queues a broker order (attention outlined, label includes qty or count when known, confirm required)
- **K** desk-wide stop / emergency (danger)

| Action | Screen | Class | Confirm | Confirm label |
|---|---|---|---|---|
| Halt new entries | Status rail | K | none (then reason popover) | — |
| Resume | Status rail, Risk | K | yes | `Resume` |
| Save risk limits | Risk | S | guards in 8.3 | `Save` |
| Allow live orders on | Risk | S (guarded) | yes | `Allow live` |
| Strategy Desk permission off with open qty | Risk | S (guarded) | yes | `Disable anyway` |
| Paper → Live | Risk | S (guarded) | yes | `Switch to live` |
| Square off one position | Books → Positions | O | yes | `Square off {qty}` |
| Clear phantom row | Books → Positions `⋯` | L | yes | `Clear ledger row` |
| Clear paper book | Setup → Maintenance, Books `⋯` | L | yes | `Clear paper book` |
| Reset all Chase to fresh signal | Setup → Maintenance | L | yes | `Reset signals` |
| Square off all open books | Now → Emergency | O | yes | `Square off all` |
| Kill intraday | Now → Emergency | K | yes, Cancel focused | `Kill intraday` |
| Kill all (incl. Chase) | Now → Emergency | K | yes, Cancel focused | `Kill all` |
| Schedule (due today) | Now → Today's jobs | N | no — queues at template time; show result inline | — |
| Square off job | Now → Today's jobs | O | yes | `Square off` |
| Delete job | Now → Today's jobs `⋯` | L | yes | `Delete job` |
| Hide alerts (today / before / all) | Why → Alerts `⋯` | L | yes | `Hide` |
| Delete signals (today / before / all) | Why → Signals `⋯` | L | yes | `Delete signals` |
| Reconcile with broker | Setup → Broker | N/L | no | — |
| Accept attribution | Setup → Broker | L | existing dialog | existing |
| Save template | Templates | S | no | — |
| Run now | Templates footer | O | yes (summary) | `Create job` |
| Save / Reset starter | Templates `⋯` | S | yes | `Save starter` / `Reset starter` |
| Attach schedule | Schedules | S | no | — |
| Remove schedule | Schedules card `⋯` | L | yes | `Remove` |
| Chase engine on/off | Chase row | T | no | — |
| Chase pause/resume | Chase row | T | no | — |
| Edit Chase book | Chase drawer | S | no | — |
| Square off one Chase book | Chase row `⋯` | O | yes | `Square off {qty}` |
| Square off all Chase books | Chase header | O | yes | `Square off all Chase` |
| Reset Chase book signal | Chase row `⋯` | L | yes | `Reset signal` |
| Add / Remove Chase underlying | Chase | S / L | remove: yes | `Remove book` |
| Momentum Save | Momentum | S | no | — |
| Preview orders | Momentum | N | no | — |
| Send rebalance | Momentum | O | yes (preview summary) | `Send {n} orders` |
| Buy spare cash / Trim | Momentum drift | O | yes | `Buy` / `Trim {p}%` |
| Daily trend Save | Daily trend | S | no | — |
| Evaluate and send | Daily trend | O | yes | `Send {n} orders` |
| Apply to all / Turn all on / off | Daily trend | S | yes | existing verbs |
| Remove symbol | Daily trend row `⋯` | L | yes | `Remove` |

`ConfirmAction` (`components/lib/ConfirmAction.tsx`, replaces `ConfirmDialog` and every `window.confirm`):

```ts
type ConfirmActionProps = {
  open: boolean
  tone: "attention" | "danger" | "neutral"
  title: string                       // verb + object + qty + book
  book?: "LIVE" | "PAPER" | "MOCK"    // renders BookBadge in the title
  will?: string[]                     // bullet list
  willNot?: string[]
  note?: string                       // e.g. market closed
  confirmLabel: string                // repeats the verb
  defaultFocus?: "cancel" | "confirm" // "cancel" for K class
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}
```

The dialog stays open with a spinner while `onConfirm` runs and shows the server error inside the dialog on failure.

---

## 10. Interaction rules

### 10.1 Errors

- Field error: under the field, danger text with icon, `aria-describedby`. Shown on blur and on submit.
- Form error summary: in the sticky footer ("{n} fields need attention"), clickable → focus first invalid field.
- Server error with a known field (e.g. `MAX_NOTIONAL`, `lots exceeds the Desk → Risk cap`) → map to the field (`lots`) and the notional preview, plus the footer.
- Server error without a field → footer (forms), inside the dialog (confirms), row notice (row actions), section message (panels). Never a page-top banner far from the control.
- Never silently change an entered value.

### 10.2 Confirmations

- Required for classes O, K (except Halt), L, and guarded S (section 9). Not for N, T, plain S.
- Title names verb, object, qty, book. Body lists Will / Will not. Confirm button repeats the verb. K class focuses Cancel by default.
- LIVE book → LIVE badge in the title. Market closed + LIVE → add the refusal note.

### 10.3 Sticky elements

- App bar (48) and the Desk view switcher (≤ 44) only, plus table header rows inside their scroll container, plus form footers inside their form panel (`position: sticky; bottom: 0` on a direct child of the scrolling panel).
- Nothing else sticks. Summary tiles scroll away.

### 10.4 Loading, empty, error states (`components/records/EmptyState.tsx`, `LoadingGate.tsx`)

- Loading: skeleton rows (3) for tables; skeleton chips for status; skeleton fields for forms. Never default values.
- Empty (no data at all): one line saying what normal looks like + at most one action. E.g. Positions: "No positions in this book." Orders: "No orders in this period. Jobs that never punched are under Why → Alerts." (link).
- Filtered empty: "No rows match {filter}." + `Clear filter`.
- Error: danger line "Could not load {thing}." + `Retry`.

### 10.5 Drawers

- Right drawer, 480 px (full-width on compact), `raised` background, title = record identity (symbol / job name), close on Esc, focus trapped, returns focus to the row.
- Position drawer: header figures; tabs Orders (for that symbol + book), Fills, Decisions, Signals.
- Job drawer: existing `TradeDetails`, `BrokerOrders`, P&L ₹ and pts as two figures.

### 10.6 Refresh

- Status rail 10 s, Today's jobs 10 s (as today), Positions 15 s, other records on focus + manual refresh icon in the toolbar showing "Updated HH:mm:ss".

---

## 11. Interface principles applied (one concrete change each)

| Principle | Change |
|---|---|
| Visual hierarchy | Desk opens on the strategy board; feeds live under Why. |
| Recognition over recall | Status rail on every page; template summary line from current form values. |
| Fitts's law / error prevention | Halt fixed in the top-right; Clear phantom moved into `⋯` away from Square off; Save in a sticky footer near the last field. |
| Proximity of feedback | Errors at the field and the footer; row actions report in the row. |
| Hick's law / cognitive load | 13 Desk tabs → 4 views; clear-feed buttons → one menu. |
| Progressive disclosure | Column glossaries → tooltips/Help; record detail → drawer; account strip collapsed. |
| Consistency | One vocabulary (section 6), one formatter (section 5), one confirm component. |
| Redundant coding | P&L = sign + colour + aria-label; state = icon + word + tone. |
| Calm technology | Neutral when normal; colour only for abnormal states and P&L sign. |
| Slips vs mistakes (Norman) | Action classes with distinct styles; confirm repeats verb and qty; Kill focuses Cancel. |

---

## 12. Component inventory (new / changed)

| Path | Purpose |
|---|---|
| `src/tokens.ts`, `src/theme.ts` | tokens, MUI theme, typography variants, component defaults |
| `lib/format.ts` | formatters (section 5) |
| `lib/ui/labels.ts` | vocabulary + `labelFor` (section 6) |
| `lib/ui/deskStatus.ts` | pure derivation: mode chip, entries chip, per-strategy effective state from `DeskStatus` |
| `lib/hooks/useDeskStatus.ts` | SWR hook for `/api/desk/status` |
| `components/shell/StatusRail.tsx` | rail (8.1) |
| `components/shell/HaltControl.tsx` | Halt / Resume + reason popover |
| `components/figures/Figure.tsx` | figure display (P&L / neutral, sizes) |
| `components/figures/BookBadge.tsx` | LIVE / PAPER / MOCK / RECONCILED / MIGRATED |
| `components/figures/StateChip.tsx` | neutral/attention/danger chips with icon |
| `components/lib/ConfirmAction.tsx` | confirm (section 9); delete `ConfirmDialog.tsx` after migration |
| `components/lib/ActionButton.tsx` | `variant: "navigate" | "save" | "ledger" | "order" | "kill"` |
| `components/forms/FormShell.tsx` | sticky footer, error summary, dirty guard |
| `components/forms/FieldRow.tsx` | label-left field layout |
| `components/records/RecordTable.tsx` | TanStack wrapper with column types `text | code | qty | price | pnl | pct | time | chip | actions` |
| `components/records/RecordDrawer.tsx` | drawer shell |
| `components/records/EmptyState.tsx`, `LoadingGate.tsx` | states |
| `components/desk/views/*` | Now / Books / Why / Setup |
| `components/desk/StrategyBoard.tsx`, `TodayJobs.tsx`, `EmergencyPanel.tsx`, `AccountStrip.tsx` | Now view |
| `components/templates/TemplateList.tsx`, `TemplateSummary.tsx` | Templates |
| `components/chase/ChaseBookDrawer.tsx` | Chase editor |
| `pages/risk.tsx`, `pages/api/desk/status.ts` | new routes |

---

## 13. Implementation plan (PR order)

Each PR is independently shippable and keeps all tests green.

### PR 1 — Tokens, fonts, formatters, vocabulary (no layout change)

- `src/tokens.ts`, `src/theme.ts` (delete `src/theme.js`), `next/font` in `_app.tsx`.
- `lib/format.ts`, `lib/ui/labels.ts` + unit tests.
- Replace `money()` / `when()` / `pnlColor()` in `pages/desk.tsx`, `components/desk/*`, `components/lib/pnlComponent.js` (→ `Figure`-based TSX, ₹ and pts as two figures), `pages/momentum.tsx`, `pages/daily-trend.tsx`, `components/lib/NotionalPreview.tsx`.
- Sessions win rate → percent. Flat Avg → `—`.
- Acceptance: every figure on Desk tabs is Mono, right-aligned, 2 decimals, signed+coloured when P&L; dates per section 5; no visual regressions in layout.

### PR 2 — Status truth (F-01…F-05, F-08, F-09)

- `GET /api/desk/status` + API test.
- `StatusRail`, `HaltControl` (reason popover), `useDeskStatus`; remove the Desk header Halt/Resume and Armed/Alerts chips.
- Sidebar badge = errors + warnings.
- Skeletons instead of defaults: `AppShell` user chip, Momentum, Daily trend.
- Momentum / Daily trend permission line + banner; switch labels "Engine on".
- Desk feedback: failures in danger tone.
- Acceptance: with `tradingEnabled=false` the rail shows `Trading off`; with `deskHalted` `Halted: reason`; with a LIVE strategy and `MOCK_ORDERS=false` the rail shows `LIVE · Chase`; with `MOCK_ORDERS=true` `MOCK`; Momentum with Risk disabled shows the banner; no default values flash on load (throttle network in DevTools to verify).

### PR 3 — Action classes and confirmations (F-17…F-25)

- `ConfirmAction`, `ActionButton`; migrate every `ConfirmDialog` and `window.confirm`.
- Emergency panel on Desk (still in the current Today tab until PR 4) with corrected loudness.
- Positions: `Square off {qty}…` + `⋯ Clear phantom row…`.
- Move Clear paper book out of the filter row (into `⋯`); feed clears into `⋯`.
- Momentum / Daily trend action separation; Daily trend row `⋯ Remove…`; Schedules remove confirm + error.
- Acceptance: grep shows no `window.confirm`; no amber/red button sits next to a filter control; Kill dialogs focus Cancel.

### PR 4 — Desk IA (F-10…F-12, F-16, F-38)

- Views Now / Books / Why / Setup, URL mapping + redirects, `RecordTable` with sticky headers, drawers, Strategy board, Today's jobs rows, Account strip, Setup → Maintenance.
- Only the view switcher is sticky.
- Acceptance: at 682×700 the live open row and its Square off are fully visible (Playwright test with viewport 682×700 and a seeded open position); at 1024×552 at least 8 position rows are visible below the switcher; old `?tab=` links land on the right view.

### PR 5 — Risk page (F-07, F-13)

- `pages/risk.tsx`, rewritten `RiskControls` (matrix, sticky footer, guards, dirty guard), redirect from `/desk?tab=risk`.
- Acceptance: Save visible at all times; disabling a strategy with open qty asks for confirmation; Paper → Live confirm shows consequences; no "Not halted" text remains.

### PR 6 — Template editor and Schedules (F-14, F-24, F-26…F-29, F-37)

- Master-detail Templates, `TemplateSummary`, `FormShell`, `FieldRow`, zod schema, 24 h pickers, market-hours validation, no silent coercion in the form path, Run now in footer.
- Schedules week grid.
- Nav renames and icons.
- Acceptance: entering `0` lots shows "Lots must be a whole number ≥ 1" and does not save; run time 17:46 shows "Outside market hours"; at 1440×900 the full editor is visible without page scroll; summary updates live and underlines unsaved parts.

### PR 7 — Chase page (F-06, F-15)

- `/api/chase-settings` `status` field + API test; read-first table; book drawer; row menu; header square-off; permission line.
- Acceptance: an open long Chase book shows `Long`, its ledger qty, avg, mark, open mark, contract, rollover; flat book shows `Awaiting signal`, qty 0, open mark `0.00`; no horizontal page scroll at 1024.

### PR 8 — Help and polish

- Help navigation, copy updates for new vocabulary, status rail help section, Login/Profile tokens, remove dead components (`ConfirmDialog`, `useSnackbar` if unused, `ScrollTable` if replaced, `Header.tsx`, `StratLayout.js`, `pages/dashboard.js` redirect if unused — verify with grep first).

**If only one sprint is available:** PR 1, PR 2, PR 3, plus from PR 4 only "tiles not sticky; table headers sticky" and from PR 6 only "no silent coercion in the form path". That addresses F-01…F-05, F-08…F-10, F-17…F-26 but **not** F-06 (Chase holdings) or F-07 (Risk page) without PR 7 and PR 5.

---

## 14. Testing and verification

### 14.1 Unit (`__tests__/unit/`)

- `format.test.ts`: every row of the section 5 table, including `−` sign, zero handling, `—`, en-IN grouping, IST boundaries (23:59 / 00:00 IST), fraction → percent.
- `labels.test.ts`: every code in 6.2; unknown code fallback.
- `deskStatus.test.ts`: matrix of `mockOrders × allowLiveOrders × tradingEnabled × deskHalted × per-strategy (enabled, halted, executionMode)` → mode chip text/tone, entries chip text/tone, per-strategy effective line. Include: `tradingEnabled=false, deskHalted=false` → `Trading off` (regression for F-02); `mockOrders=true` overrides LIVE.
- `templateSchema.test.ts`: lots `0`, `1.5`, `""`, over Risk cap; times outside market hours; ASO before run time; loss floor accepts negative and positive.
- Update `helpContent.test.ts`, `utilsAndLabels.test.ts`, `planLabels.test.ts` for renamed labels.

### 14.2 API (`__tests__/api/`)

- `/api/desk/status`: auth required; shape; counts match `/api/desk/alerts?summary=1`; does not write (row counts unchanged).
- `/api/chase-settings` GET: `status` present per book; flat book `unrealizedPnl === "0"`; existing fields unchanged.

### 14.3 E2E (`__tests__/e2e/`) — selectors to update

| Spec | Current selector | New |
|---|---|---|
| `today-list.spec.ts` | button `/square off all open/i` | button `/square off all open books/i` (Now → Emergency) |
| `today-list.spec.ts`, `straddle-schedule.spec.ts` | tab `Today` | toggle/button `Now` (view switcher) |
| `straddle-schedule.spec.ts` | heading `MONDAY` | heading `Mon` |
| `straddle-schedule.spec.ts` | `Run now` click | `Run now…` then dialog button `Create job` |
| `mobile.spec.ts` | `getByText("Today", { exact: true })`, bar link `Plan` | `Now`; bar link `Templates` |
| `mobile.spec.ts`, `desk-feed.spec.ts` | button `/clear today/i`, `/clear all/i` | open `⋯` menu (`aria-label="Alert actions"`), menuitem `/today/i`, `/all/i` |
| `mobile.spec.ts` | tab `/risk/i` → heading `Risk limits` | navigate `/risk`, heading `Risk` |
| `dashboard.spec.ts`, `auth.spec.ts`, `adversarial.spec.ts` | text `Today` | `Now` |
| `dashboard.spec.ts` | link `/plan/i` | link `/schedules/i` |
| `desk-ui.spec.ts` | Chase `row /^NIFTY\b/ … spinbutton` | open row `⋯` → `Edit book…`, drawer spinbutton `Lots` |
| `desk-ui.spec.ts` | button `Reset status` | menuitem `Reset to fresh signal…` |
| `desk-ui.spec.ts` | button `Save unsaved changes` | drawer button `Save` |
| `plan.spec.ts` | text `/monday|tuesday|plan/i` | `/mon|tue|schedules/i` |

Add:

- `status-rail.spec.ts`: rail renders on `/desk`, `/templates`, `/chase`, `/momentum`; Halt opens reason popover; Resume asks for confirm.
- `compact-positions.spec.ts`: viewport 682×700 with a seeded open position; the row and `Square off` are fully in view after scrolling to the bottom (`toBeInViewport({ ratio: 1 })`).
- `template-validation.spec.ts`: lots `0` blocked with field error; 17:46 run time flagged.
- Keep `accessibility.spec.ts` (axe) green; add the new pages to it.

### 14.4 Simulation / adversarial

The revamp must not change `lib/simulation`, `lib/trading`, queues, or strategy code. Run `yarn sim-test` on every PR to prove it. If any PR needs to touch those paths, stop and split it out; that work needs the adversarial checklist in `AGENTS.md`.

### 14.5 Manual verification checklist (local MOCK stack)

For each viewport 1440×900, 1024×552, 682×700, 390×844:

1. Rail shows correct mode for: MOCK; `MOCK_ORDERS=false` + Allow live off; Allow live on + Chase LIVE.
2. Toggle Trading enabled off on `/risk`, Save → rail shows `Trading off` on every page.
3. Halt from the rail → `Halted: Halted from status rail`; add a reason → rail updates; Resume confirm → `Entries allowed`, Trading enabled back on.
4. Desk → Now: board rows match `/api/desk/portfolio` `today` and `strategyPnl` values exactly (compare numbers).
5. Books → Positions: open row fully visible; Square off dialog shows qty from the ledger row; Clear phantom dialog starts with "This does not send a Kite order."
6. Templates: lots 0 blocked; summary line matches fields; Save from footer without scrolling.
7. Chase: state/qty match `/desk?view=books&tab=positions` for the same symbol.
8. Momentum / Daily trend with Risk disabled → banner visible; reload with network throttled → skeletons, no default values.
9. Keyboard only: reach Halt, open a drawer, confirm/cancel a dialog; focus ring always visible.

---

## 15. Decisions already made (do not block on these)

| Question | Default |
|---|---|
| Keep `/plan` route? | Yes; title and nav say Schedules. |
| Remove sidebar Straddle / Strangle items? | Yes; Templates type filter replaces them; old `?type=` links still work. |
| Intraday row on the board split into straddle vs strangle? | No; use the existing `intraday` group. Split later only if the API adds separate groups. |
| Show points on the board? | No. Points only in template/job contexts. |
| Halt confirm? | No confirm; reason popover after. Resume keeps a confirm. |
| Signals grouping default | On. |
| Account strip default | Collapsed; remember the choice in `localStorage` (`cmdesk.accountStrip`). |
| Light theme | Not in scope. |
| Mobile-first redesign | Not in scope; compact layout must stay usable (8.12). |

---

## 16. Do not change

- Trading rules, risk evaluation, ledger accounting, P&L definitions, queue behaviour, Kite calls.
- The meaning of any stored field (including the signed loss floor in `trailingMaxLossPoints`).
- Dual P&L (₹ in UI, points for target P&L).
- Visibility of FLAT and leftover rows.
- Accuracy of confirm copy (restructure only).
- The expiry rule + resolved date display, the notional sentence, the Contracts chips, Chase row notices.
- IST everywhere; en-IN digit grouping.
- `server.js` boot, Bull Board at `/queues` (and never render BullMQ queue names in the app UI).
