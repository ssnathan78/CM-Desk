import { FormControlLabel, MenuItem, Switch, TextField } from "@mui/material"
import type { KeyboardEvent, ReactNode } from "react"

import FieldRow from "./FieldRow"

export function SettingsSwitchField({
  label,
  checked,
  onChange,
  helper,
  helperPlacement,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  helper?: string
  helperPlacement?: "below" | "tooltip"
}) {
  return (
    <FieldRow label={label} wide helper={helper} helperPlacement={helperPlacement}>
      <FormControlLabel
        label={checked ? "On" : "Off"}
        control={<Switch checked={checked} onChange={e => onChange(e.target.checked)} />}
      />
    </FieldRow>
  )
}

export function SettingsNumberField({
  label,
  value,
  helper,
  helperPlacement,
  onChange,
  step,
}: {
  label: string
  value: number
  helper?: string
  helperPlacement?: "below" | "tooltip"
  onChange: (value: number) => void
  step?: number
}) {
  return (
    <FieldRow label={label} helper={helper} helperPlacement={helperPlacement}>
      <TextField
        fullWidth
        size="small"
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        slotProps={step != null ? { htmlInput: { step } } : undefined}
      />
    </FieldRow>
  )
}

export function SettingsSelectField<T extends string>({
  label,
  value,
  helper,
  helperPlacement,
  onChange,
  children,
}: {
  label: string
  value: T
  helper?: string
  helperPlacement?: "below" | "tooltip"
  onChange: (value: T) => void
  children: ReactNode
}) {
  return (
    <FieldRow label={label} helper={helper} helperPlacement={helperPlacement}>
      <TextField
        select
        fullWidth
        size="small"
        value={value}
        onChange={e => onChange(e.target.value as T)}
      >
        {children}
      </TextField>
    </FieldRow>
  )
}

export function SettingsTextField({
  label,
  value,
  helper,
  helperPlacement,
  onChange,
  placeholder,
  onKeyDown,
}: {
  label: string
  value: string
  helper?: string
  helperPlacement?: "below" | "tooltip"
  onChange: (value: string) => void
  placeholder?: string
  onKeyDown?: (e: KeyboardEvent) => void
}) {
  return (
    <FieldRow label={label} helper={helper} helperPlacement={helperPlacement}>
      <TextField
        fullWidth
        size="small"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </FieldRow>
  )
}
