import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "./drizzle"
import { mapJobExecutionInsert } from "./jobExecutionMapper"
import { mapPlanFromDb, mapPlanToDb } from "./planMapper"
import { jobExecutions, orders, strategySchedules, strategyTemplates } from "./schema"
import {
  assertUniqueTemplateName,
  canDeleteTemplate,
  canUpdateJobFromTemplate,
  expiryRuleForInstrument,
} from "./strategyTemplateRules"

const TEMPLATE_STRATEGIES = new Set(["ATM_STRADDLE", "ATM_STRANGLE"])

function templateRow(config: Record<string, unknown>) {
  const mapped = mapPlanToDb(config)
  delete mapped.dayOfWeek
  return mapped
}

export async function listTemplates() {
  const templates = await db.select().from(strategyTemplates).orderBy(strategyTemplates.name)
  const schedules = await db.select().from(strategySchedules)
  return {
    templates: templates.map(row => mapPlanFromDb(row)),
    schedules,
  }
}

export async function saveTemplate(config: Record<string, unknown>, id?: string) {
  const strategy = String(config.strategy || "")
  if (!TEMPLATE_STRATEGIES.has(strategy)) {
    return { ok: false as const, status: 400, error: "Templates are Straddle or Strangle" }
  }
  const existingNames = (
    await db
      .select({ id: strategyTemplates.id, name: strategyTemplates.name })
      .from(strategyTemplates)
  )
    .filter(row => row.id !== id)
    .map(row => row.name)
  const nameError = assertUniqueTemplateName(String(config.name || ""), existingNames)
  if (nameError) return { ok: false as const, status: 400, error: nameError }
  const expiryError = expiryRuleForInstrument(
    String(config.instrument || ""),
    String(config.expiryType || "")
  )
  if (expiryError) return { ok: false as const, status: 400, error: expiryError }

  const values = templateRow({ ...config, name: String(config.name).trim() })
  if (id) {
    const [row] = await db
      .update(strategyTemplates)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(strategyTemplates.id, id))
      .returning()
    if (!row) return { ok: false as const, status: 404, error: "Template not found" }
    return { ok: true as const, template: mapPlanFromDb(row) }
  }
  const [row] = await db
    .insert(strategyTemplates)
    .values(values as never)
    .returning()
  return { ok: true as const, template: mapPlanFromDb(row) }
}

export async function duplicateTemplate(id: string) {
  const [row] = await db.select().from(strategyTemplates).where(eq(strategyTemplates.id, id))
  if (!row) return { ok: false as const, status: 404, error: "Template not found" }
  const config = mapPlanFromDb(row) as Record<string, unknown>
  const names = (await db.select({ name: strategyTemplates.name }).from(strategyTemplates)).map(
    item => item.name
  )
  let name = `${row.name} copy`
  let n = 2
  while (names.some(existing => existing.toLowerCase() === name.toLowerCase())) {
    name = `${row.name} copy ${n}`
    n += 1
  }
  return saveTemplate({ ...config, name })
}

export async function deleteTemplate(id: string) {
  const schedules = await db
    .select({ id: strategySchedules.id })
    .from(strategySchedules)
    .where(eq(strategySchedules.templateId, id))
  const openJobs = await db
    .select({ id: jobExecutions.id })
    .from(jobExecutions)
    .where(
      and(
        eq(jobExecutions.templateId, id),
        inArray(jobExecutions.status, ["PENDING", "QUEUE", "EXECUTING"])
      )
    )
  const blocked = canDeleteTemplate({
    scheduleCount: schedules.length,
    openJobCount: openJobs.length,
  })
  if (blocked) return { ok: false as const, status: 409, error: blocked }
  await db.delete(strategyTemplates).where(eq(strategyTemplates.id, id))
  return { ok: true as const }
}

export async function saveSchedule(input: {
  templateId: string
  dayOfWeek: string
  runAt?: string | null
  enabled?: boolean
}) {
  const [template] = await db
    .select()
    .from(strategyTemplates)
    .where(eq(strategyTemplates.id, input.templateId))
  if (!template) return { ok: false as const, status: 404, error: "Template not found" }
  const day = input.dayOfWeek.toUpperCase()
  const [existing] = await db
    .select()
    .from(strategySchedules)
    .where(
      and(
        eq(strategySchedules.templateId, input.templateId),
        eq(strategySchedules.dayOfWeek, day as never)
      )
    )
  const runAt = input.runAt ? new Date(input.runAt) : template.runAt
  if (existing) {
    const [row] = await db
      .update(strategySchedules)
      .set({
        runAt,
        enabled: input.enabled ?? existing.enabled,
        updatedAt: new Date(),
      })
      .where(eq(strategySchedules.id, existing.id))
      .returning()
    return { ok: true as const, schedule: row }
  }
  const [row] = await db
    .insert(strategySchedules)
    .values({
      templateId: input.templateId,
      dayOfWeek: day as never,
      runAt,
      enabled: input.enabled ?? true,
    })
    .returning()
  return { ok: true as const, schedule: row }
}

export async function deleteSchedule(id: string) {
  await db.delete(strategySchedules).where(eq(strategySchedules.id, id))
  return { ok: true as const }
}

export function templateToJobBody(
  template: Record<string, unknown>,
  extras: { runNow?: boolean; runAt?: unknown; dayOfWeek?: string }
) {
  return {
    ...template,
    ...extras,
    templateId: template.id,
    planRef: template.id,
    id: undefined,
  }
}

export async function editPendingJob(jobId: string, config: Record<string, unknown>) {
  const [job] = await db.select().from(jobExecutions).where(eq(jobExecutions.id, jobId))
  if (!job) return { ok: false as const, status: 404, error: "Job not found" }
  const filled = await db
    .select({ qty: sql<number>`coalesce(sum(${orders.filledQty}), 0)` })
    .from(orders)
    .where(eq(orders.jobId, jobId))
  const filledQty = Number(filled[0]?.qty ?? 0)
  const gate = canUpdateJobFromTemplate({ status: job.status, filledQty })
  if (!gate.ok) return { ok: false as const, status: 409, error: gate.error }
  const body = mapJobExecutionInsert(config)
  delete body.templateId
  delete body.planRef
  const [updated] = await db
    .update(jobExecutions)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(jobExecutions.id, jobId))
    .returning()
  return { ok: true as const, job: updated }
}

export async function updateJobFromTemplate(jobId: string) {
  const [job] = await db.select().from(jobExecutions).where(eq(jobExecutions.id, jobId))
  if (!job) return { ok: false as const, status: 404, error: "Job not found" }
  if (!job.templateId) {
    return { ok: false as const, status: 400, error: "This job was not created from a template" }
  }
  const filled = await db
    .select({ qty: sql<number>`coalesce(sum(${orders.filledQty}), 0)` })
    .from(orders)
    .where(eq(orders.jobId, jobId))
  const filledQty = Number(filled[0]?.qty ?? 0)
  const gate = canUpdateJobFromTemplate({ status: job.status, filledQty })
  if (!gate.ok) return { ok: false as const, status: 409, error: gate.error }
  const [template] = await db
    .select()
    .from(strategyTemplates)
    .where(eq(strategyTemplates.id, job.templateId))
  if (!template) return { ok: false as const, status: 404, error: "Template not found" }
  const body = mapJobExecutionInsert(
    templateToJobBody(mapPlanFromDb(template) as Record<string, unknown>, {})
  )
  delete body.templateId
  const [updated] = await db
    .update(jobExecutions)
    .set({ ...body, templateId: job.templateId, planRef: job.planRef, updatedAt: new Date() })
    .where(eq(jobExecutions.id, jobId))
    .returning()
  return { ok: true as const, job: updated }
}
