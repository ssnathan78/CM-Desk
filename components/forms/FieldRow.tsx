import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import { Box, IconButton, Tooltip, Typography } from "@mui/material"
import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from "react"

export default function FieldRow({
  label,
  helper,
  helperPlacement = "below",
  wide,
  children,
}: {
  label: string
  helper?: string
  /** Long copy in a label tooltip keeps dense grids from wrapping awkwardly. */
  helperPlacement?: "below" | "tooltip"
  /** Radio/checkbox groups and sliders use full width beside the label. */
  wide?: boolean
  children: ReactNode
}) {
  const labelId = useId()
  const inputId = useId()

  const control =
    !wide && isValidElement(children)
      ? cloneElement(children as ReactElement<{ id?: string; "aria-label"?: string }>, {
          id: (children as ReactElement<{ id?: string }>).props.id ?? inputId,
          "aria-label": label,
        })
      : children

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" },
        gap: { xs: 0.5, sm: 2 },
        alignItems: "start",
        mb: 1.5,
      }}
    >
      {wide ? (
        <Typography id={labelId} variant="body2" color="text.secondary" sx={{ pt: { sm: 1 } }}>
          {label}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.25, pt: { sm: 1 } }}>
          <Typography component="label" htmlFor={inputId} variant="body2" color="text.secondary">
            {label}
          </Typography>
          {helper && helperPlacement === "tooltip" ? (
            <Tooltip title={helper}>
              <IconButton size="small" aria-label={`About ${label}`} sx={{ mt: -0.25, p: 0.25 }}>
                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>
      )}
      <Box
        role={wide ? "group" : undefined}
        aria-labelledby={wide ? labelId : undefined}
        sx={{ minWidth: 0, maxWidth: wide ? "none" : 280, width: wide ? "100%" : undefined }}
      >
        {control}
        {helper && helperPlacement === "below" ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {helper}
          </Typography>
        ) : null}
      </Box>
    </Box>
  )
}
