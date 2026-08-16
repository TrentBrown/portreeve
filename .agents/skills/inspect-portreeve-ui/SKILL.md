---
name: inspect-portreeve-ui
description:
  Launch and operate PortReeve's development-only Electron UI inspector for interactive
  desktop-app refinement. Use when the user asks to enter PortReeve UI inspection mode,
  point at or identify an arbitrary desktop UI element, or iteratively tweak desktop
  terminology, phrasing, formatting, styling, or layout by selecting elements in the
  running app.
---

# Inspect PortReeve UI

Use PortReeve's Playwright-backed Electron harness so the user can Option-click a
renderer element and the agent can connect that selection to its implementation.

## Start inspection mode

1. Resolve the active repository root with `git rev-parse --show-toplevel` and run all
   commands there.
2. Reuse an inspector session already owned by the current task when one is live.
   Otherwise, launch `bun run desktop:inspect` in an interactive terminal session and
   keep that session open. Allow the release build and Electron startup to finish before
   declaring the inspector ready.
3. Tell the user that the inspection window is ready. Ask them to Option-click one
   element or Shift-Option-click additional elements they want to discuss. Do not
   require them to describe elements that the picker can identify.

The harness isolates Electron caches and Desktop preferences, but it still connects to
the user's live per-user PortReeve service. Emphasize that Option-click replaces the
selection and Shift-Option-click extends or reduces it without activating elements. Do
not issue ordinary clicks or lifecycle operations unless the user explicitly requests
the action and its effect is understood.

## Read and inspect selections

- Read the ordered JSON selection set printed after an Option-click or
  Shift-Option-click. Use the numbered outlines and `selectionNumber` fields to
  correlate elements. If the terminal session is available, send `selected` to print the
  set again.
- Use the `Latest selection set` path announced at startup when the session output is no
  longer immediately available. Each descriptor contains the selector, text, attributes,
  bounding box, and selected computed styles.
- Use `inspect <selector>` for refreshed DOM and style evidence, `snapshot` for the
  accessibility tree, and `screenshot` when spatial context materially helps.
- Use `select <selector>` to replace the selection, `add <selector>` to toggle a member,
  `clear` to empty the set, or `hover <selector>` for non-activating inspection from the
  terminal. Treat `click <selector>` as a live action subject to the same safety
  boundary as a normal click in the app.

## Make iterative changes

1. Map the selected text, attributes, or selector to renderer source with `rg`.
2. Confirm the owning component and styles before editing; do not infer ownership solely
   from visible copy when it appears in more than one place.
3. Make the smallest requested change while preserving unrelated work.
4. Send `reload` to the inspector after renderer-only changes when that can show the
   result without rebuilding. Restart `bun run desktop:inspect` when the changed layer
   requires a rebuilt release candidate or Electron main-process restart.
5. Run verification proportional to the change and report what was checked.
6. Keep the inspector open while the user is continuing the refinement session. Send
   `quit` when the session is finished or the user asks to close it.

The harness also accepts `help`. For implementation details and the complete command
summary, read `apps/desktop/README.md` and `scripts/inspect-desktop.js` only as needed.
