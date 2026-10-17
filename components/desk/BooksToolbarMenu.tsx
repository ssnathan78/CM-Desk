import { Button } from "@mui/material"

/** One action. A labeled button, not an unlabeled menu. */
export default function BooksToolbarMenu({ onClearPaper }: { onClearPaper: () => void }) {
  return (
    <Button size="small" onClick={onClearPaper} sx={{ ml: { md: "auto" } }}>
      Clear paper book…
    </Button>
  )
}
