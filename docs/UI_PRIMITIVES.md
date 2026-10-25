# Accessible workspace primitives

DOTS-016 introduces reusable, zero-dependency React primitives for the owner workspace.

- `CommandButton` is a native button with a stable 44px minimum target and visible focus.
- `AccessiblePopover` uses native `details` and `summary`, so keyboard and touch activation do not depend on hover.
- `AgentCard` uses an original monogram placeholder, a named heading, visible operational summary, and an explicitly labeled action.
- `StatusChip` always renders text beside its decorative light. Colors reinforce `ready`, `waiting`, and `inactive`; they never carry state alone.
- `MetricBars` exposes the exact numerator and denominator in a definition list. Bars are decorative.
- `LoadingSkeleton` announces its loading purpose while hiding decorative lines from assistive technology.
- `OverlayPanel` has a named non-modal dialog landmark and an explicit close control.

The preview data is synthetic and does not imply that a model, worker, provider, campaign, message, or paid resource is active. DOTS-017 owns navigation and command-bar behavior; DOTS-016 does not introduce it.

## Verification

Repository checks validate native control semantics, readable status labels, chart text, loading announcements, non-modal overlay naming, responsive breakpoints, focus-visible styling, reduced-motion behavior, and the absence of remote avatar imagery or decorative quotations.
