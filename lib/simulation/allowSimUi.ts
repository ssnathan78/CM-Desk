export function isSimUiAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true
  return process.env.ALLOW_SIM_UI === "true"
}
