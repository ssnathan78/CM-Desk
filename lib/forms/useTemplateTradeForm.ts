import { zodResolver } from "@hookform/resolvers/zod"
import { type FieldValues, type Resolver, useForm } from "react-hook-form"

import { templateTradeFormSchema } from "./templateTradeFormSchema"

const templateTradeResolver = zodResolver(
  templateTradeFormSchema
) as unknown as Resolver<FieldValues>

export function useTemplateTradeForm<T extends FieldValues>(state: T) {
  return useForm<T>({
    values: state,
    resolver: templateTradeResolver as unknown as Resolver<T>,
    mode: "onSubmit",
  })
}
