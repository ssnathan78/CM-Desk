export const color = {
  bg: { canvas: "#0F1217", surface: "#151A21", raised: "#1B212A", inset: "#0B0E12" },
  border: { subtle: "#232A33", default: "#2A313C", strong: "#3A4350" },
  text: { primary: "#E6EAF0", secondary: "#A3ADBB", disabled: "#6E7787", inverse: "#0F1217" },
  accent: { main: "#7AA2FF", hover: "#94B4FF", subtle: "rgba(122,162,255,0.14)" },
  profit: "#4CC38A",
  loss: "#F47A72",
  attention: { main: "#E3A93B", subtle: "rgba(227,169,59,0.14)", on: "#1A1300" },
  danger: {
    main: "#C93C37",
    hover: "#B3322E",
    subtle: "rgba(201,60,55,0.16)",
    text: "#F47A72",
    on: "#FFFFFF",
  },
  live: { bg: "#E3A93B", fg: "#1A1300" },
  paper: { border: "#3A4350", fg: "#A3ADBB" },
} as const
