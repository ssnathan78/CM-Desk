import { reduceShortcutState } from "../../lib/ui/keyboardShortcuts"

function keyEvent(key: string, opts: { shiftKey?: boolean } = {}) {
  return {
    key,
    shiftKey: opts.shiftKey ?? false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
  } as unknown as KeyboardEvent
}

describe("reduceShortcutState", () => {
  it("opens help on ?", () => {
    const result = reduceShortcutState(false, keyEvent("?"))
    expect(result.action).toBe("help")
  })

  it("navigates with g then d", () => {
    const afterG = reduceShortcutState(false, keyEvent("g"))
    expect(afterG.pendingG).toBe(true)
    const afterD = reduceShortcutState(true, keyEvent("d"))
    expect(afterD.action).toBe("desk")
  })
})
