# Process reliability

A restart during the session is normal. These boundaries exist so a crash, a duplicate job, or a short outage of Postgres, Redis, or Kite cannot open a second position or leave an exit unarmed while the desk looks healthy.

`server.js` is the process. Workers start with it, after migrations are current. Queues are BullMQ. Postgres is the ledger. Time is Asia/Kolkata.

## Startup

1. Docker runs `yarn migrate`, then `yarn start`.
2. `server.js` compares `drizzle/meta/_journal.json` with `drizzle.__drizzle_migrations`. If anything is pending, the process exits and does not listen. It does not apply SQL. Several historical migrations drop or rename columns. Apply them only with `yarn migrate`.
3. `startDeskProcess` in `lib/queue-processor/index.ts` repeats that check, then starts each worker once. The promise lives on `globalThis`, so a second import does not start a second set.
4. `/api/health` awaits that start. Postgres and Redis can be up while this check fails. A healthy response means workers were started.
5. The same boot restores today's Chase schedules and fails job rows whose Redis entry is gone.

Do not boot workers from a page load. Do not import a queue processor in a way that constructs a second `Worker` for the same queue.

## Orders

`lib/trading/brokerPlace.ts` decides whether `placeOrder` may call the broker.

| Saved intent | What happens |
|---|---|
| This call inserted the row | Place once |
| Working or filled, broker id stored | Return that id. Do not place |
| No broker id yet | Read the broker book. If the order is there, store the id and return it |
| Book does not show it, younger than 60 seconds | Throw `OrderAckUnknownError`. Do not place |
| Book does not show it, older than 60 seconds | Place on the same row |
| Status `FAILED`, `REJECTED`, or `CANCELLED` | A new ledger key is allowed, then place |

A network timeout, socket reset, or Kite `NetworkException` marks the row `UNKNOWN`. It does not mark `FAILED`. `FAILED` is only for a clear reject (`OrderException`, `InputException`, permission, token). A retry of `UNKNOWN` uses the same key.

Freeze-quantity slices pass `intentSlice` so two slices of the same quantity do not share a key. Leave the slice off the key when it is absent. Changing the unsliced key format makes every in-flight order look new.

Stops and flattens do not use the entry duplicate check in the risk engine, because amending a stop must still work. They are protected by the reuse rule above. A second `placeSL` that does not see the working stop in the broker book still hits the ledger row and does not send another order.

`remoteOrderSuccessEnsurer` may retry a clear reject. It must not treat an unknown ack as permission to send a second order. Catch `OrderAckUnknownError` and wait.

## Entry jobs and exits

The entry worker places the strategy, then arms follow-ups, then completes.

- Per-leg stop: job id `exit-<execution id>`
- Loss/profit watcher: job id `target-<execution id>`
- Auto square-off: job id `aso-<execution id>`

A second add with the same id is success. Arming throws if Redis rejects the add for any other reason, and the entry job retries. Retries are safe only because `placeOrder` reuses the first intent. Do not mark the entry `COMPLETED` in the worker and attach the stop afterwards.

Entry jobs get three attempts, 15 seconds apart, unless a strategy sets its own count. The loss watcher throws if square-off throws, so the watcher keeps running. Do not resolve that job as success when the flatten did not happen.

A delayed entry that starts more than **3 minutes** after its scheduled time is discarded and alerted (`Late trading job discarded`). The strike is chosen at execution, so a 9:20 job must not run at 14:00. Explicit **Run now** has no delay and is not late. Same-day square-off still runs if the worker was down. A previous calendar day is discarded as stale.

One open job per template per IST day (`PENDING`, `QUEUE`, `EXECUTING`). A `FAILED` or `REJECT` row does not hide the template. On boot, a `PENDING` or `QUEUE` row with no Redis job, older than 2 minutes, is marked `FAILED` and alerted so the operator can send it again. Chase rows are restored from the repeating schedule, not failed by that sweep.

## Chase

Schedules cover today only (minute stops through 15:30 IST, hourly EMA through 16:15 IST). They are upserted from the latest access token on boot, on every Kite login, and on the hourly cash pass. Login refreshes them even when the token was already stored. A swallowed Redis error must not store the token and then skip the next login. `addToChaseQueue` throws.

The minute and hourly jobs read today's token from Postgres, then the token stored on the schedule. A midday re-login is picked up without waiting for a new schedule.

`LONG` / `SHORT` still require a fill. If Kite quantity is unknown, do not clear `LONG` / `SHORT` and do not enter. Unknown is not zero. A stop touch in any candle of the fetched window counts, not only the last print. A feed older than 180 seconds with no touch in that window is skipped and alerted.

## Cash rebalance and daily trend

The hourly timer is guarded with `globalThis.__cmDeskCashScheduler`. The history pull is guarded with `globalThis.__cmDeskCashPull`. Two copies of the module in one process share those flags. Two processes share Postgres.

Momentum **claims** `lastRebalanceOn` for the IST day before it sends. The second pass sees the claim and does not send. A rejected basket stays claimed, and an alert is written. That day is not retried. Do not clear the claim to recover rejects. A crash after the claim and before the send also leaves the day claimed. That misses a basket. A second basket is worse.

Daily trend does not send another buy while a working `ENTRY` for that symbol already exists. It sets `PENDING_LONG` and waits. An immediate reject still leaves the symbol flat so a later pass can buy.

## Tests

Pure decisions live in helpers and are covered by `__tests__/unit/trading/processReliability.test.ts`:

- reuse, lookup, wait, and late place
- ambiguous broker errors versus clear rejects
- late entry versus run-now
- follow-up job ids
- stuck job reconcile
- Chase unknown quantity and a stop touch inside the window
- a working daily-trend entry
- pending migration tags

When you add a queue, an order path, or a schedule, extend that file or the helper it calls. Run `yarn unit-test` and `yarn sim-test`. Simulation does not boot BullMQ or Kite. A green simulation does not prove a restart will not double an order.

## What not to do

- Do not mark a job completed and attach its stop in a `completed` handler that ignores errors.
- Do not give follow-up jobs a random id.
- Do not treat an empty Kite position response as a flat book when the call failed.
- Do not punch a late 9:20 entry to “catch up”.
- Do not flatten a leftover 9:20 wing, or size a flatten from configured lots, to clean up a missed exit.
- Do not start the server on a database that is behind the journal.
