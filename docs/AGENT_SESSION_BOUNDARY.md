# Agent guide: session boundary

Read this before adding or changing an API route, a confirm, a job edit, a queue payload, or a path that turns live sending on. Order safety is [AGENT_ORDER_SAFETY.md](AGENT_ORDER_SAFETY.md). Operator sentences are [AGENT_OPERATOR_ACTIONS.md](AGENT_OPERATOR_ACTIONS.md).

CM-Desk is one operator. The session cookie is the whole desk. A request that already has that cookie can call every mutating route. A dialog in the browser is not a check.

## Conditions

| What must be true | Where it is decided |
|---|---|
| A mutating route has a logged-in session | Each handler checks `req.session.user` after `withSession`. `withSession` only loads the cookie. |
| Live Kite for a new entry | `MOCK_ORDERS=false`, Desk “Allow live orders”, and that strategy’s Execution = Live. The request body cannot set any of the three. |
| Square-off, Kill intraday, Kill all | The body includes the phrase from `lib/operatorConfirm.ts`. |
| Allow live orders turns from off to on | `PUT /api/desk/risk` includes `confirmLive` with `ALLOW_LIVE_CONFIRM`. Other risk fields can save without that phrase. |
| A queued straddle or strangle keeps its identity | `strategy`, `lots`, `productType`, `instrument`, and `volatilityType` stay as they were at enqueue. |
| Worker size matches the stored job | `mapJobExecutionQueuePayload` copies those fields from the database row. `assertOrderAllowed` uses the stored lots and rejects an entry whose quantity is larger (`JOB_LOTS`). |
| Chase reset | Open quantity, or a quantity that cannot be read, refuses the reset. The route ignores a client `force` flag. |
| Attribute a broker fill | `POST /api/desk/reconcile-strategy` includes `ATTRIBUTE`, and that strategy already has a position or an order in the symbol. |
| A 500 response | `safeErrorMessage` returns a short application sentence. Query text, bound parameters, stacks, and credentials stay in the server log. |

`GET /api/health` is the unauthenticated exception. It does not write orders, risk, or books. The Kite login callback is unauthenticated by design and is allowlisted in production.

## Boundaries

- The cookie is `HttpOnly` and `SameSite=Lax`. A form on another site does not send it. The actor for these checks is the operator’s browser, or anyone holding the cookie.
- Confirmation phrases live in `lib/operatorConfirm.ts`. The desk dialog sends the phrase after the operator confirms. The API rejects the action when the phrase is missing. Clear-paper and clear-phantom already follow this shape (`CLEAR PAPER`, `CLEAR`).
- `editPendingJob` refuses a change to a frozen field and then omits those fields from the update. `updateJobFromTemplate` omits them too, so a template refresh can change exits and still cannot retarget the job.
- `collectPlanExtras` keeps only hedge and strike-selection keys. A nested `extras` object cannot carry lots, strategy, product, direction, purpose, or quantity onto the worker.
- Placement reads the strategy from the job row by order tag (`remoteOrderSuccessEnsurer`). The worker builds the order from the queue payload. Those two copies must describe the same job. The payload is stamped from the row, and the risk check prefers the row’s lots.
- `allowLiveArm` runs before `saveRiskSettings`. A save that tries to turn Allow live orders on without the phrase is rejected as a whole. The flag is not stripped and saved beside the other fields.
- Reconcile compare (`GET`) can show a difference for any known strategy. Accept (`POST`) writes a reconciled fill only for a strategy the ledger already ties to that symbol, and only inside `acceptedQuantity`.
- Chase go-live, phantom clear, and flatten call `resetChaseSignalState` without a bypass. An open book stays LONG or SHORT.
- Production error text is `safeErrorMessage`. `planApiErrorMessage` maps known constraint codes and otherwise returns “Could not save template”.

## Guard rails

These already let a session change a live book, or return a query to the browser.

1. Do not treat a React `ConfirmAction` as the authorization. The route that performs the write checks the phrase.
2. Do not spread `req.body`, `req.body.extras`, or `req.body.config` onto a queue payload or a job update after validation. Copy an allowlist, then stamp identity fields from the stored row.
3. Do not add a `force` (or equivalent) flag that skips an open-book refusal on Chase reset, flatten, or go-live.
4. Do not let the client choose `executionMode`, `allowLiveOrders`, `isMock`, or provenance. Those come from the process environment and the risk row.
5. Do not attribute a fill to a strategy that has no position and no order in that symbol.
6. Do not return `err.message`, `err.stack`, `err.cause.detail`, or a Drizzle query error to the client. Log the error. Respond with `sendApiError` or a fixed sentence.
7. A new mutating route checks the session, checks the method, validates an allowlist, and requires a phrase when the action squares off, kills, arms live sending, or writes a reconciled fill.

## How to implement a new feature or fix

1. Name the effect: which rows change, whether an order is sent, and whether live sending becomes possible.
2. If the effect squares off, kills, arms Allow live orders, or writes a broker fill onto a strategy book, add a phrase in `lib/operatorConfirm.ts` and reject the route without it. Send that phrase from the dialog that already asks the operator. Keep the dialog open until the reply.
3. If the feature edits a queued job or enqueues one, pass the body through `mapJobExecutionInsert` and `mapJobExecutionQueuePayload`. Do not add lots, strategy, product, instrument, or direction to the extras allowlist. Frozen fields stay on the row that was queued.
4. If the feature places an order, go through `placeOrder`. The risk gate loads lots from the job row when the order has a tag. An entry larger than those lots times the contract size is `JOB_LOTS`.
5. If the feature turns a strategy Live, keep using `PUT /api/desk/risk`. That route already checks an empty book. Turning Allow live orders on also needs `confirmLive`.
6. If a failure can include a query or a bound value, throw an `Error` whose message is a short sentence the operator can read, or let `sendApiError` hide it.
7. Add a unit test that fails if the old path returns: missing phrase accepted, extras lots win, frozen field written, Chase reset proceeds with size, reconcile accepts an untied strategy, or a query string is in the response. Run `yarn unit-test`. Routes that write risk or jobs also want `yarn api-test` when Postgres is up.
8. Update this file when the boundary changes. A comment on the route is not the rule.
