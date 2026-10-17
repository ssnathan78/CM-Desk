import { z } from "zod"

import { validateSelectedInstruments } from "../strategyValidation"
import { templateLotsSchema, templateTimeSchema, validateTemplateTimes } from "./templateSchema"

const instrumentsSchema = z.record(z.string(), z.boolean())

export const templateTradeFormSchema = z
  .object({
    name: z.string().trim().min(1, "Template name is required"),
    lots: z.union([z.number(), z.string()]),
    instruments: instrumentsSchema,
    runAt: z.string().optional(),
    squareOffTime: z.string().optional(),
    isAutoSquareOffEnabled: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const lotsZ = templateLotsSchema.safeParse(data.lots)
    if (!lotsZ.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: lotsZ.error.issues[0]?.message ?? "Invalid lots",
        path: ["lots"],
      })
    }

    const instCheck = validateSelectedInstruments(data.instruments as Record<string, boolean>)
    if (!instCheck.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: instCheck.error,
        path: ["instruments"],
      })
    }

    const runAt = String(data.runAt ?? "")
    const asoEnabled = Boolean(data.isAutoSquareOffEnabled)
    const runOnly = templateTimeSchema.safeParse(runAt)
    if (!runOnly.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: runOnly.error.issues[0]?.message ?? "Invalid run time",
        path: ["runAt"],
      })
    }
    if (asoEnabled) {
      const timeErr = validateTemplateTimes(runAt, String(data.squareOffTime ?? ""))
      if (timeErr) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: timeErr,
          path: ["squareOffTime"],
        })
      }
    }
  })

export function firstTemplateTradeFormError(state: unknown): string | null {
  const parsed = templateTradeFormSchema.safeParse(state)
  if (parsed.success) return null
  return parsed.error.issues[0]?.message ?? "Invalid template"
}
