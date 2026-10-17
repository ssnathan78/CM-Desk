import { createTheme } from "@mui/material/styles"

import { color } from "./tokens"

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: color.accent.main,
      contrastText: color.text.inverse,
    },
    secondary: {
      main: color.text.secondary,
      contrastText: color.text.primary,
    },
    error: {
      main: color.danger.main,
    },
    warning: {
      main: color.attention.main,
    },
    info: {
      main: color.accent.main,
    },
    success: {
      main: color.profit,
    },
    background: {
      default: color.bg.canvas,
      paper: color.bg.surface,
    },
    text: {
      primary: color.text.primary,
      secondary: color.text.secondary,
      disabled: color.text.disabled,
    },
    divider: color.border.subtle,
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 4,
  typography: {
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    fontSize: 14,
    h1: { fontSize: 20, lineHeight: "28px", fontWeight: 600 },
    h2: { fontSize: 15, lineHeight: "22px", fontWeight: 600 },
    h3: { fontSize: 13, lineHeight: "20px", fontWeight: 600 },
    h5: { fontSize: 15, lineHeight: "22px", fontWeight: 600 },
    h6: { fontSize: 13, lineHeight: "20px", fontWeight: 600 },
    body1: { fontSize: 14, lineHeight: "20px", fontWeight: 400 },
    body2: { fontSize: 13, lineHeight: "18px", fontWeight: 400 },
    overline: {
      fontSize: 12,
      lineHeight: "16px",
      fontWeight: 500,
      textTransform: "none",
      letterSpacing: 0,
    },
    caption: { fontSize: 12, lineHeight: "16px", fontWeight: 400 },
    button: { fontSize: 13, lineHeight: "20px", fontWeight: 600, textTransform: "none" },
    figure: {
      fontFamily: "var(--font-mono), monospace",
      fontSize: 13,
      lineHeight: "20px",
      fontWeight: 400,
      fontVariantNumeric: "tabular-nums",
    },
    figureLg: {
      fontFamily: "var(--font-mono), monospace",
      fontSize: 15,
      lineHeight: "20px",
      fontWeight: 500,
      fontVariantNumeric: "tabular-nums",
    },
    code: {
      fontFamily: "var(--font-mono), monospace",
      fontSize: 12.5,
      lineHeight: "18px",
      fontWeight: 400,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: color.bg.canvas,
        },
        "*:focus-visible": {
          outline: `2px solid ${color.accent.main}`,
          outlineOffset: 2,
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${color.border.default}`,
          backgroundColor: color.bg.surface,
        },
      },
    },
    MuiButton: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiIconButton: { defaultProps: { size: "small" } },
    MuiToggleButton: { defaultProps: { size: "small" } },
    MuiChip: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: 12,
          borderRadius: 4,
        },
      },
    },
    MuiTable: { defaultProps: { size: "small" } },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          minHeight: 40,
        },
      },
    },
  },
})

export default theme
