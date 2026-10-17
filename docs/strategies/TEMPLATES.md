# Strategy templates

Straddle and Strangle configurations are named templates. Chase, Momentum, and Daily trend are not templates.

A template has a unique name, one strategy type, one instrument, and an expiry rule (`CURRENT`, `NEXT`, or `MONTHLY`). The rule list follows the instrument: Nifty can use a monthly expiry; the other indexes cannot. The contract date is chosen when the job fires.

A schedule is that template on one weekday, with a clock and an enabled flag. One template can have several weekdays. One weekday can run two Nifty straddles when they are two templates.

A job is a copy made when you schedule or run now. Later edits to the template do not rewrite that job. Update from template is explicit, and it is refused once any order for the job has filled. Two jobs from the same template on the same day are allowed. Desk risk still caps lots, notional, and open positions.

`strategy_defaults` is only the blank starter for New template. Reset starter deletes that row and the next new template uses the built-in form. `trade_plans` remains in the database from the previous weekday rows. New saves do not write it. `job_executions.plan_ref` is still filled when that id is a `trade_plans` row, so older signal links keep resolving. New jobs store `template_id`.

Delete is refused while a schedule or a pending, queued, or executing job points at the template.
