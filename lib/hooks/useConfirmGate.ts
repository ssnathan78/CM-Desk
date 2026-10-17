import { useCallback, useState } from "react"

export function useConfirmGate<T = void>() {
  const [pending, setPending] = useState<T | null>(null)
  const open = useCallback((payload: T) => setPending(payload), [])
  const close = useCallback(() => setPending(null), [])
  return { pending, open, close, isOpen: pending !== null }
}
