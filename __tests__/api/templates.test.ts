import templatesHandler from "../../pages/api/templates"
import schedulesHandler from "../../pages/api/schedules"
import { invokeApi } from "../support/apiTestClient"
import { createTestPool, describeDb } from "../support/dbHelpers"
import { minimalPlanConfig } from "../support/jobFixtures"
import { createTestUser } from "../support/sessionFactory"
import { STRATEGIES } from "../../lib/constants"

describeDb("templates and schedules", () => {
  const pool = createTestPool()
  const user = createTestUser()
  const templateIds: string[] = []
  const jobIds: string[] = []

  afterAll(async () => {
    if (jobIds.length) {
      await pool.query(`DELETE FROM orders WHERE job_id = ANY($1::text[])`, [jobIds])
      await pool.query(`DELETE FROM job_executions WHERE id = ANY($1::text[])`, [jobIds])
    }
    if (templateIds.length) {
      await pool.query(`DELETE FROM strategy_schedules WHERE template_id = ANY($1::text[])`, [
        templateIds,
      ])
      await pool.query(`DELETE FROM strategy_templates WHERE id = ANY($1::text[])`, [templateIds])
    }
    await pool.end()
  })

  async function createNamed(name: string, instrument = "NIFTY", expiryType = "CURRENT") {
    const result = await invokeApi(templatesHandler, {
      method: "POST",
      user,
      body: {
        config: {
          ...minimalPlanConfig(STRATEGIES.ATM_STRADDLE),
          name,
          instrument,
          expiryType,
          lots: 1,
        },
      },
    })
    const body = result.body as { id?: string; error?: string }
    if (body.id) templateIds.push(body.id)
    return result
  }

  it("rejects a duplicate name and accepts two Nifty templates on Friday", async () => {
    const first = await createNamed(`Open ${Date.now()}`)
    expect(first.status).toBe(200)
    const id = (first.body as { id: string }).id
    const dup = await createNamed((first.body as { name: string }).name)
    expect(dup.status).toBe(400)

    const second = await createNamed(`Hedge ${Date.now()}`)
    expect(second.status).toBe(200)
    const friday = await invokeApi(schedulesHandler, {
      method: "POST",
      user,
      body: { templateId: id, dayOfWeek: "FRIDAY" },
    })
    const other = await invokeApi(schedulesHandler, {
      method: "POST",
      user,
      body: { templateId: (second.body as { id: string }).id, dayOfWeek: "FRIDAY" },
    })
    expect(friday.status).toBe(200)
    expect(other.status).toBe(200)
  })

  it("keeps the job snapshot after a template edit and refuses a filled job", async () => {
    const created = await createNamed(`Snap ${Date.now()}`)
    const templateId = (created.body as { id: string }).id
    const inserted = await pool.query(
      `INSERT INTO job_executions (name, strategy, instrument, lots, status, template_id, expiry_type, product_type)
       VALUES ($1, 'ATM_STRADDLE', 'NIFTY', 1, 'PENDING', $2, 'CURRENT', 'MIS')
       RETURNING id`,
      [`Snap job ${Date.now()}`, templateId]
    )
    const jobId = inserted.rows[0].id as string
    jobIds.push(jobId)

    await invokeApi(templatesHandler, {
      method: "PUT",
      user,
      body: {
        id: templateId,
        config: {
          ...minimalPlanConfig(STRATEGIES.ATM_STRADDLE),
          id: templateId,
          name: (created.body as { name: string }).name,
          lots: 3,
        },
      },
    })
    const before = await pool.query(`SELECT lots FROM job_executions WHERE id = $1`, [jobId])
    expect(before.rows[0].lots).toBe(1)

    const copied = await invokeApi(templatesHandler, {
      method: "POST",
      user,
      body: { action: "update-job", jobId },
    })
    expect(copied.status).toBe(200)
    const after = await pool.query(`SELECT lots FROM job_executions WHERE id = $1`, [jobId])
    expect(after.rows[0].lots).toBe(3)

    await pool.query(
      `INSERT INTO trading_accounts (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`
    )
    await pool.query(
      `INSERT INTO orders (account_id, job_id, side, exchange, tradingsymbol, requested_qty, remaining_qty, filled_qty, status, idempotency_key)
       VALUES ('default', $1, 'SELL', 'NFO', 'NIFTY', 1, 0, 1, 'FILLED', $2)`,
      [jobId, `template-fill-${jobId}`]
    )
    const refused = await invokeApi(templatesHandler, {
      method: "POST",
      user,
      body: { action: "update-job", jobId },
    })
    expect(refused.status).toBe(409)
  })

  it("refuses BankNifty monthly expiry and delete while scheduled", async () => {
    const monthly = await createNamed(`Monthly ${Date.now()}`, "BANKNIFTY", "MONTHLY")
    expect(monthly.status).toBe(400)
    const created = await createNamed(`Delete ${Date.now()}`)
    const id = (created.body as { id: string }).id
    await invokeApi(schedulesHandler, {
      method: "POST",
      user,
      body: { templateId: id, dayOfWeek: "MONDAY" },
    })
    const blocked = await invokeApi(templatesHandler, {
      method: "DELETE",
      user,
      body: { id },
    })
    expect(blocked.status).toBe(409)
    const schedule = await pool.query(
      `SELECT id FROM strategy_schedules WHERE template_id = $1`,
      [id]
    )
    await invokeApi(schedulesHandler, {
      method: "DELETE",
      user,
      body: { id: schedule.rows[0].id },
    })
    const gone = await invokeApi(templatesHandler, {
      method: "DELETE",
      user,
      body: { id },
    })
    expect(gone.status).toBe(200)
  })

  it("run now copies the template id onto the job", async () => {
    const created = await createNamed(`Run ${Date.now()}`)
    const templateId = (created.body as { id: string }).id
    const result = await invokeApi(schedulesHandler, {
      method: "POST",
      user,
      body: { action: "today", templateId, runNow: true },
    })
    expect([200, 409]).toContain(result.status)
    const jobId = (result.body as { id?: string }).id
    expect(jobId).toBeTruthy()
    if (jobId) jobIds.push(jobId)
    const row = await pool.query(`SELECT template_id, plan_ref, lots FROM job_executions WHERE id = $1`, [
      jobId,
    ])
    expect(row.rows[0].template_id).toBe(templateId)
    expect(row.rows[0].plan_ref).toBeNull()
  })
})
