import Button from "@mui/material/Button"
import type { ButtonProps } from "@mui/material/Button"

import { color } from "../../src/tokens"

type Variant = "navigate" | "save" | "ledger" | "order" | "kill"

type Props = Omit<ButtonProps, "color" | "variant"> & {
  actionVariant: Variant
}

export default function ActionButton({ actionVariant, sx, ...rest }: Props) {
  switch (actionVariant) {
    case "save":
      return <Button variant="contained" color="primary" sx={sx} {...rest} />
    case "order":
      return <Button variant="outlined" color="warning" sx={sx} {...rest} />
    case "kill":
      return (
        <Button
          variant="contained"
          sx={{
            bgcolor: color.danger.main,
            color: color.danger.on,
            "&:hover": { bgcolor: color.danger.hover },
            ...sx,
          }}
          {...rest}
        />
      )
    case "ledger":
      return <Button variant="outlined" color="inherit" sx={sx} {...rest} />
    default:
      return <Button variant="text" sx={sx} {...rest} />
  }
}
