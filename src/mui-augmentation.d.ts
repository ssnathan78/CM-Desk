import "@mui/material/styles"

declare module "@mui/material/styles" {
  interface TypographyVariants {
    figure: React.CSSProperties
    figureLg: React.CSSProperties
    code: React.CSSProperties
  }

  interface TypographyVariantsOptions {
    figure?: React.CSSProperties
    figureLg?: React.CSSProperties
    code?: React.CSSProperties
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    figure: true
    figureLg: true
    code: true
  }
}

export {}
