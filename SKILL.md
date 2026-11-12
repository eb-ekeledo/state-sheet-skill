---
name: state-sheet
description: Renders every state of a UI component on one review sheet (default, hover, focus, pressed, disabled, loading, empty, error, success, long text, huge numbers, RTL, in light and dark at two widths) and flags what breaks. Use when someone asks to QA, review or stress test a component, see all its states, or check where it breaks before shipping. Not for adding new states to code from scratch.
---

# State sheet

Designers used to lay out every state of a component side by side and spot the broken one at a glance. In code you only ever see one state at a time. This skill puts them all back on one sheet, and flags problems automatically.

## Workflow

1. **Pick the cases.** Start from the standard list in `references/cases.md`. Keep the ones that apply to this component, and write realistic props for each (real names, real lengths, real numbers). Save them as `cases.json` next to the component.
2. **Make the component renderable per case.** Two options:
   - **Plain HTML/CSS/JS:** write a `component.html` harness that defines `window.renderComponent(props, { theme })` and returns an HTML string or element. Include the component's real CSS. See `examples/`.
   - **React, Vue, Svelte or any app with a dev server:** add a dev-only route, for example `/__sheet?case=<id>&theme=<light|dark>`, that renders the component with that case's props inside `<div data-sheet-root>`, and sets `data-theme` on `<html>`. Don't ship this route.
3. **Render the sheet.**
   ```bash
   node scripts/sheet.js --html component.html --cases cases.json --out state-sheet
   # or
   node scripts/sheet.js --url "http://localhost:5173/__sheet?case={case}&theme={theme}" --cases cases.json --out state-sheet
   ```
   Options: `--widths 320,560`, `--themes light,dark`, `--title "Pricing card"`, `--strict` (exit 1 on any flag, for CI).
4. **Show the sheet first.** Share `state-sheet/sheet.png` and the flag table from `report.md`. Lead with the count: "3 of 9 states break."
5. **Look as well as measure.** Automatic flags catch overflow, contrast, missing focus, size jumps and empty renders. Look at the image too for what they can't catch: a dark mode that ignores a state, RTL icons pointing the wrong way, a spinner that looks like an error. Call these out by cell.
6. **Fix, then re-run.** Propose fixes one flag at a time, apply them, and render the sheet again so the person sees every cell go clean.

## What gets flagged

| Flag | Meaning |
| --- | --- |
| Text clipped | Content is wider than its box and gets cut with no ellipsis |
| Number cut off | An amount, ID or count is truncated with an ellipsis |
| Spills out of the component | Text runs past the component's edge |
| Contrast | Text under WCAG AA (4.5:1, or 3:1 for large text). Disabled controls are exempt |
| No visible focus ring | Tab reaches the control but nothing visibly changes |
| Size changes | A state marked `sameSizeAs` changes size (for example a button that shrinks while loading) |
| Renders nothing | The case produced no content: a missing state |

## Rules

- Use real content in cases, never lorem ipsum. Long text means the longest real value, not a random string.
- Keep the sheet monochrome; red is reserved for flags.
- If the component has no meaningful state for a case (a static badge has no loading state), leave the case out instead of faking it.
- Mention related skills for building missing states, but this skill reviews; it doesn't generate.
