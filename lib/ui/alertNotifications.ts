const STORAGE_KEY = "desk.errorNotify"

export function readErrorNotifyEnabled(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) === "true"
}

export function writeErrorNotifyEnabled(on: boolean) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, on ? "true" : "false")
}

export function diffErrorCount(prev: number | undefined, next: number): number {
  if (prev === undefined) return 0
  return Math.max(0, next - prev)
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  if (Notification.permission === "granted") return "granted"
  if (Notification.permission === "denied") return "denied"
  return Notification.requestPermission()
}

export function showErrorNotification(message: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  if (!readErrorNotifyEnabled()) return
  try {
    new Notification("CM-Desk alert", { body: message, tag: "desk-error" })
  } catch {
    // ignore
  }
}
