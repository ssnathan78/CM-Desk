export const DESK_THEME_IDS = [
  "desk",
  "harbour",
  "blueprint",
  "night-watch",
  "study-lamp",
  "ledger",
] as const

export type DeskThemeId = (typeof DESK_THEME_IDS)[number]

export type DeskColors = {
  bg: { canvas: string; surface: string; raised: string; inset: string }
  border: { subtle: string; default: string; strong: string }
  text: { primary: string; secondary: string; disabled: string; inverse: string }
  accent: { main: string; hover: string; subtle: string }
  profit: string
  loss: string
  attention: { main: string; subtle: string; on: string }
  danger: { main: string; hover: string; subtle: string; text: string; on: string }
  live: { bg: string; fg: string }
  paper: { border: string; fg: string }
}

export type DeskTheme = DeskColors & {
  id: DeskThemeId
  label: string
  description: string
  mode: "light" | "dark"
  swatch: [string, string, string]
}

const desk: DeskTheme = {
  id: "desk",
  label: "Desk",
  description: "The current night screen. Red and amber stay on the actions that change a book.",
  mode: "dark",
  swatch: ["#0F1217", "#7AA2FF", "#C93C37"],
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
}

const ledger: DeskTheme = {
  id: "ledger",
  label: "Ledger",
  description:
    "Warm paper and ink. Indigo marks a link. Profit and loss are text, not blocks of color.",
  mode: "light",
  swatch: ["#F6F1E8", "#2C3E6B", "#8C3A3A"],
  bg: { canvas: "#F6F1E8", surface: "#FFFCF7", raised: "#F3EEE6", inset: "#EFE8DC" },
  border: { subtle: "#E4DCD0", default: "#D9D0C3", strong: "#C9BEAE" },
  text: { primary: "#1C1915", secondary: "#6B645C", disabled: "#A39A90", inverse: "#FFFCF7" },
  accent: { main: "#2C3E6B", hover: "#3D5284", subtle: "rgba(44,62,107,0.10)" },
  profit: "#1F6B45",
  loss: "#8C3A3A",
  attention: { main: "#8A6A2F", subtle: "rgba(138,106,47,0.12)", on: "#FFFCF7" },
  danger: {
    main: "#8C3A3A",
    hover: "#742F2F",
    subtle: "rgba(140,58,58,0.10)",
    text: "#8C3A3A",
    on: "#FFFCF7",
  },
  live: { bg: "#E7E1D4", fg: "#1C1915" },
  paper: { border: "#D9D0C3", fg: "#6B645C" },
}

const studyLamp: DeskTheme = {
  id: "study-lamp",
  label: "Study lamp",
  description:
    "Warm charcoal and cream. Brass replaces the red slab. Sage and clay mark profit and loss.",
  mode: "dark",
  swatch: ["#1A1714", "#C4A574", "#C4897A"],
  bg: { canvas: "#1A1714", surface: "#24201C", raised: "#2C2823", inset: "#141210" },
  border: { subtle: "#3A342C", default: "#4A433A", strong: "#5C5348" },
  text: { primary: "#F3EBE1", secondary: "#B7AA9C", disabled: "#7A7066", inverse: "#1A1714" },
  accent: { main: "#C4A574", hover: "#D4B88A", subtle: "rgba(196,165,116,0.16)" },
  profit: "#9BB89A",
  loss: "#C4897A",
  attention: { main: "#C4A574", subtle: "rgba(196,165,116,0.16)", on: "#1A1714" },
  danger: {
    main: "#A5685C",
    hover: "#8E574C",
    subtle: "rgba(165,104,92,0.18)",
    text: "#C4897A",
    on: "#F3EBE1",
  },
  live: { bg: "#3A3228", fg: "#F3EBE1" },
  paper: { border: "#4A433A", fg: "#B7AA9C" },
}

const harbour: DeskTheme = {
  id: "harbour",
  label: "Harbour",
  description:
    "Blue-black night. Cards are a lighter navy, type is near white, and the accent is sky blue.",
  mode: "dark",
  swatch: ["#06141C", "#38BDF8", "#F8FBFF"],
  bg: { canvas: "#06141C", surface: "#0E2433", raised: "#143044", inset: "#040C12" },
  border: { subtle: "#1E4A66", default: "#4B7C9A", strong: "#7DD3FC" },
  text: { primary: "#F8FBFF", secondary: "#D6E2EC", disabled: "#8AA0B4", inverse: "#06141C" },
  accent: { main: "#38BDF8", hover: "#7DD3FC", subtle: "rgba(56,189,248,0.16)" },
  profit: "#34D399",
  loss: "#FB7185",
  attention: { main: "#FBBF24", subtle: "rgba(251,191,36,0.16)", on: "#06141C" },
  danger: {
    main: "#FB7185",
    hover: "#F43F5E",
    subtle: "rgba(251,113,133,0.16)",
    text: "#FECDD3",
    on: "#06141C",
  },
  live: { bg: "#38BDF8", fg: "#06141C" },
  paper: { border: "#4B7C9A", fg: "#D6E2EC" },
}

const blueprint: DeskTheme = {
  id: "blueprint",
  label: "Blueprint",
  description:
    "White page, blue cards, near-black buttons, and a strong blue rule. The card is the colored part.",
  mode: "light",
  swatch: ["#FFFFFF", "#1E3A8A", "#E7EEF8"],
  bg: { canvas: "#FFFFFF", surface: "#E7EEF8", raised: "#D6E2F4", inset: "#F8FAFC" },
  border: { subtle: "#93A6D4", default: "#1E3A8A", strong: "#0F172A" },
  text: { primary: "#0F172A", secondary: "#1E3A8A", disabled: "#64748B", inverse: "#F8FAFC" },
  accent: { main: "#0F172A", hover: "#1E293B", subtle: "rgba(15,23,42,0.08)" },
  profit: "#047857",
  loss: "#BE123C",
  attention: { main: "#9A3412", subtle: "rgba(154,52,18,0.12)", on: "#FFFFFF" },
  danger: {
    main: "#BE123C",
    hover: "#9F1239",
    subtle: "rgba(190,18,60,0.10)",
    text: "#BE123C",
    on: "#FFFFFF",
  },
  live: { bg: "#1E3A8A", fg: "#F8FAFC" },
  paper: { border: "#1E3A8A", fg: "#1E3A8A" },
}

const nightWatch: DeskTheme = {
  id: "night-watch",
  label: "Night watch",
  description:
    "Near-black page, charcoal cards, cream type, and a bright gold accent. Profit is a clear green.",
  mode: "dark",
  swatch: ["#07080B", "#F5C451", "#FAFAF9"],
  bg: { canvas: "#07080B", surface: "#1A1D24", raised: "#262B34", inset: "#000000" },
  border: { subtle: "#3A4150", default: "#8B93A7", strong: "#F5C451" },
  text: { primary: "#FAFAF9", secondary: "#D4D4D8", disabled: "#8B919C", inverse: "#07080B" },
  accent: { main: "#F5C451", hover: "#FDE68A", subtle: "rgba(245,196,81,0.16)" },
  profit: "#4ADE80",
  loss: "#FF8A7A",
  attention: { main: "#F5C451", subtle: "rgba(245,196,81,0.16)", on: "#07080B" },
  danger: {
    main: "#FF8A7A",
    hover: "#F87171",
    subtle: "rgba(255,138,122,0.16)",
    text: "#FFD0C8",
    on: "#07080B",
  },
  live: { bg: "#F5C451", fg: "#07080B" },
  paper: { border: "#8B93A7", fg: "#D4D4D8" },
}

export const DESK_THEMES: Record<DeskThemeId, DeskTheme> = {
  desk,
  harbour,
  blueprint,
  "night-watch": nightWatch,
  "study-lamp": studyLamp,
  ledger,
}

export function parseDeskThemeId(raw: string | null | undefined): DeskThemeId {
  if (raw && (DESK_THEME_IDS as readonly string[]).includes(raw)) return raw as DeskThemeId
  return "desk"
}
