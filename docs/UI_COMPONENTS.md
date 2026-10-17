# UI components and patterns

Reference for how CM-Desk builds operator screens. Trading behaviour lives in strategy specs and `AGENTS.md`; this document is **presentation only** — what to use, where it lives, and how pages should feel consistent.

Navigation map: [UI.md](./UI.md). Deploy: [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Mental model

```
AppShell (sidebar, status rail, title)
  └── Layout (max width, loading spinner)
        └── Page content (Stack of PageSections)
              ├── intro (title row + Guide + permission line)
              ├── settings / toolbars (compact controls)
              ├── tables (ScrollTable or RecordTable)
              ├── drawers (edit one row)
              └── ConfirmAction dialogs (destructive / live)
```

Feedback that does not block the UI:

- **Snackbar (toast)** — short success/error after save, add row, etc.
- **Alert banner** — persistent until dismissed or replaced (`useActionNotice`).
- **ConfirmAction** — must confirm before irreversible or live actions.

---

## App shell

| Piece | File | Role |
|--------|------|------|
| **AppShell** | `components/AppShell.tsx` | Sidebar nav, mobile bottom nav, mounts status rail and page body. |
| **Layout** | `components/Layout.tsx` | Wraps children in `AppShell`; optional `loading` spinner; `maxWidth` (`lg` default, Chase uses `xl`). |
| **Status rail** | `components/shell/StatusRail.tsx`, `HaltControl.tsx` | LIVE/PAPER, entries, alerts count, clock, halt/resume. Data: `GET /api/desk/status`. |
| **Mobile operator sheet** | `components/shell/MobileOperatorSheet.tsx` | “More” menu on small viewports. |

The **app bar title** comes from `Layout title="…"` (e.g. “Chase”, “Momentum”). Strategy pages often repeat a human title in the body (`Typography variant="h5"`) plus a **Guide** button — see [Page header pattern](#page-header-pattern).

---

## Page structure

### PageSection

`components/lib/PageSection.tsx` — outlined panel with a header band (title, optional description, optional `actions` slot) and body.

- Use **`flush`** when the main child is a table (no side padding on the table; small top pad only).
- Put **column chooser** (`TableColumnMenu`), toggles, or export in **`actions`** (Chase / Momentum / Daily trend book sections).

Examples: Chase “Books”, Daily trend “Book table”, Desk Books positions.

### FormSection

`components/forms/FormSection.tsx` — same header band as `PageSection`, used inside **template** editors (straddle/strangle). Prefer `PageSection` on desk/strategy pages; `FormSection` on `/templates` forms.

---

## Page header pattern

Continuous strategies (Chase, Momentum, Daily trend) share:

1. **Optional `h5`** in the body (Momentum, Daily trend).
2. **`Button component={Link} href="/help/…" size="small"`** — **Guide** as a proper button/link (primary styling), not inline grey text inside a paragraph.
3. **Intro paragraph** (`Typography variant="body2" color="text.secondary"`).
4. **`StrategyPermissionLine`** — one line: engine on/off, desk permission, book, page execution mode; warning if engine on but strategy disabled on Risk.

Chase: app bar title only; **Guide** sits next to “Square off all Chase books…” in the top row.

---

## Tables

### When to use which

| Component | File | Use for |
|-----------|------|---------|
| **ScrollTable** | `components/lib/ScrollTable.tsx` | Wide, many-column grids on strategy pages (Chase books, Momentum rank, Daily trend book). Horizontal scroll on the **page** (no jump bar). |
| **TableColumnMenu** | `components/lib/TableColumnMenu.tsx` | Column visibility + ↑↓ reorder in `PageSection` `actions`. Persists order in `lib/ui/columnVisibility.ts`. |
| **StrategyTablePagination** | `components/lib/StrategyTablePagination.tsx` | Shared footer: 10 / 20 / 50 / 100 / All (`lib/ui/tablePagination.ts`). |
| **RecordTable** | `components/records/RecordTable.tsx` | Desk Books (positions, orders, trades, sessions). TanStack columns; row click opens drawer. |

**Do not** set `maxHeight` on `ScrollTable` for normal strategy books — that creates a nested vertical scroll cage. Let the page scroll vertically; use the column menu to hide optional fields.

### ScrollTable props

| Prop | Purpose |
|------|---------|
| `minWidth` | Forces horizontal scroll when viewport is narrower (e.g. 1100). |
| `maxHeight` | Avoid on strategy tables unless you have a rare embedded panel need. |

### Sticky columns

Daily trend pins checkbox/symbol columns with local `pin()` helpers and `position: sticky`. Chase pins the **Book** column. Momentum pins the **Lock** actions column on the right.

### Desk RecordTable row clicks

Clicks on **buttons, switches, menus** must not open the row drawer — `RecordTable` ignores interactive targets; action cells call `stopPropagation` (e.g. `PositionRowActions`).

---

## Toolbars vs mini-forms

| Pattern | What it is | Example |
|---------|------------|---------|
| **Toolbar** | One or two **horizontal rows**: compact switches, small select, primary **Save**, then secondary actions. No `FieldRow` label column. | `DailyTrendEngineToolbar` — Engine, Pull daily, Execution, Save; second row: Pull history, Evaluate, … |
| **Mini-form / settings block** | Stacked **`FieldRow`** rows (label left, control right). Good for many numeric fields or helpers. | Momentum “Run & filters”, Chase **drawer**, Risk limits. |
| **Inline table edit** | Selected rows + bulk bar on Daily trend; Momentum uses column visibility menu. | Daily trend symbol book |

Rule of thumb: **runtime toggles** on a long page → toolbar. **Deep parameters** per symbol → drawer or inline columns.

---

## Forms and fields

| Piece | File | Role |
|--------|------|------|
| **FieldRow** | `components/forms/FieldRow.tsx` | Label + optional helper (tooltip or below) + control. |
| **SettingsSwitchField** | `components/forms/SettingsFields.tsx` | Switch with On/Off label. |
| **SettingsSelectField** | same | Full-width select in a row. |
| **SettingsNumberField** / **SettingsTextField** | same | Typed inputs for settings pages. |

Templates and Risk use these heavily. Chase book **editing** uses `FieldRow` inside `ChaseBookDrawer`, not in the main grid.

---

## Drawers

| Drawer | File | Opens when |
|--------|------|------------|
| **RecordDrawer** | `components/records/RecordDrawer.tsx` | Generic right drawer shell (title, subtitle, close). |
| **PositionDetailDrawer** | `components/desk/PositionDetailDrawer.tsx` | Desk → Books → Positions row click. |
| **ChaseBookDrawer** | `components/chase/ChaseBookDrawer.tsx` | Chase row click or ⋮ → Edit. |
| **DailyTrendBookDrawer** | `components/daily-trend/DailyTrendBookDrawer.tsx` | Daily trend Edit on a symbol. |

Drawers hold **edit** flows and charts (Chase spark). **Read-mostly** state stays in the table.

---

## Buttons and actions

| Piece | File | Role |
|--------|------|------|
| **ActionButton** | `components/lib/ActionButton.tsx` | Semantic variants: `save`, `order`, `kill`, `ledger`, `navigate`. |
| **ConfirmAction** | `components/lib/ConfirmAction.tsx` | Modal confirm; tones `attention` / `danger` / `neutral`; no `window.confirm`. |
| **EmergencyPanel** | `components/desk/EmergencyPanel.tsx` | Desk kill / flatten entry points with confirms. |

Live or destructive: always **ConfirmAction** with a clear message (flatten, clear phantom, evaluate-and-send, remove book).

---

## Feedback: snackbar, banners, row notices

### Snackbar (toast)

- **Hook:** `useSnackbar()` from `components/lib/useSnackbar.ts`
- **API:** `showMessage(text, severity)` — `success` | `error` | `info` | `warning`
- **Stack:** notistack, mounted in `_app`
- **Use for:** Chase book save/add/reset (replaces text under the Book column), generic saves, flatten notices.

```tsx
const { showMessage } = useSnackbar()
showMessage("Saved.", "success")
```

### Action notice (banner)

- **Hook:** `useActionNotice()` from `components/lib/ActionNotice.tsx`
- **API:** `showNotice(text, severity)` + render `<NoticeBanner />` in the section
- **Use for:** Search/add underlying on Chase (section-level), errors that should stay visible until dismissed (errors do not auto-fade).

### Row notices (`useRowNotices`)

- Per-row map with auto-fade for success/info. **Avoid inside table cells** — long text blows up row height. Prefer **snackbar** with `labelFor(symbol): message` (Chase pattern).

---

## Figures and books

| Piece | File | Role |
|--------|------|------|
| **Figure** | `components/figures/Figure.tsx` | `kind`: `inr`, `price`, `qty`, etc. — mono, P&amp;L coloring. |
| **BookBadge** | `components/figures/BookBadge.tsx` | LIVE / PAPER chip. |
| **labelFor** | `lib/ui/labels.ts` | Human strategy and index names. |

Do not show raw `ATM_STRADDLE` or `MIDCPNIFTY` in UI without `labelFor`.

---

## Desk-specific

| Piece | Role |
|--------|------|
| **DeskViewChrome** | `?view=now\|books\|why\|setup` tabs. |
| **buildDeskColumns** | Positions/orders/trades column defs. |
| **PositionRowActions** | Square off + ⋮ menu; stops row navigation. |
| **GoLiveReadinessPanel**, **ReconSummaryCard**, etc. | Setup / Now widgets — see [UI.md](./UI.md). |

---

## Strategy permission line

`components/strategy/StrategyPermissionLine.tsx` — Momentum and Daily trend only (Chase uses inline desk line under intro).

Shows engine vs **Desk → Risk** enabled, execution mode, and page execution label (report / manual / auto).

---

## Chase books table extras

- **Config at a glance:** EMA, buffer, protect, offset, open classify columns (`ChaseBooksTable` + `lib/chase/chaseBookCompare.ts`).
- **Amber cell:** value differs from first **enabled** book in index order.
- **Frozen book column**; optional columns via header **Columns** menu.
- **Toasts:** book actions via `bookToast()` → snackbar, not text in the Book cell.

---

## Theming and tokens

- **Theme:** `src/theme.ts`, dark palette.
- **Tokens:** `src/tokens.ts` — surfaces, accent, attention (diff highlight), danger.
- **MUI 9** — Pages Router, `size="small"` defaults on many components.

---

## Consistency checklist (Chase / Momentum / Daily trend)

| Concern | Pattern |
|---------|---------|
| Wide data grid | `PageSection` + `flush` + `ScrollTable` |
| Horizontal overflow | Page scroll; hide columns via `TableColumnMenu` |
| Pagination | `StrategyTablePagination` (default 50 rows) |
| Vertical overflow | **No** inner `maxHeight` on main book table |
| Guide | `Button component={Link}` to `/help/…`, not grey inline link |
| Save engine settings | Toolbar or explicit Save; Chase engine/pause save immediately on switch |
| Edit one symbol/book | Drawer |
| Operator feedback | Snackbar for transient; `ConfirmAction` for risky |

---

## File index (shared UI)

```
components/lib/     PageSection, ScrollTable, ConfirmAction, ActionButton, useSnackbar
components/forms/   FieldRow, SettingsFields, FormSection
components/figures/ Figure, BookBadge
components/records/ RecordDrawer, RecordTable
components/strategy/ StrategyPermissionLine
components/desk/    Desk views, PositionRowActions, drawers
components/chase/   ChaseBooksTable, ChaseBookDrawer
components/daily-trend/ DailyTrendEngineToolbar, DailyTrendBookDrawer
lib/ui/labels.ts    labelFor, humanizeCode
lib/format.ts       INR, IST times
```

When you add a new operator surface, match an existing pattern from this list before inventing a fourth table style.
