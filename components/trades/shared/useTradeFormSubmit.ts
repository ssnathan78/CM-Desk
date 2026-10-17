import type { FormEvent } from "react"

import { formatFormDataForApi } from "../../../lib/browserUtils"
import type { STRATEGIES } from "../../../lib/constants"
import { useTemplateTradeForm } from "../../../lib/forms/useTemplateTradeForm"
import { withIndexTick } from "../../../lib/strategyValidation"
import type { AvailablePlansConfig } from "../../../types/plans"

export function useTradeFormSubmit<T extends AvailablePlansConfig>({
  state,
  strategy,
  embedded,
  notice,
  onChange,
  onSubmit,
}: {
  state: T
  strategy: STRATEGIES
  embedded: boolean
  notice?: string | null
  onChange: (patch: Partial<T>) => void
  onSubmit: (data: AvailablePlansConfig | null) => void
}) {
  const { handleSubmit, formState } = useTemplateTradeForm(state)
  const { errors } = formState

  const submitValidated = handleSubmit(() => {
    const next = embedded ? withIndexTick(state) : state
    if (next !== state) onChange(next as Partial<T>)
    onSubmit(formatFormDataForApi({ strategy, data: next }))
  })

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submitValidated()
  }

  const fieldErrors = errors as Record<string, { message?: string } | undefined>
  const lotsError = fieldErrors.lots?.message
  const instrumentError = fieldErrors.instruments?.message
  const formError =
    notice ||
    lotsError ||
    instrumentError ||
    fieldErrors.runAt?.message ||
    fieldErrors.squareOffTime?.message ||
    fieldErrors.name?.message

  return { handleFormSubmit, formError, lotsError, instrumentError }
}
