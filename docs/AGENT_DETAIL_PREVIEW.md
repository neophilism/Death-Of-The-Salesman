# Agent detail preview

DOTS-024 adds two accessible inspection levels to the searchable roster.

- Pointer hover and keyboard focus reveal a compact quick peek fixed inside the viewport. It summarizes the current task, exact last-activity time, verified-event count and spend.
- Click, tap or keyboard activation opens a native modal dialog with task, strategy, exact timestamps, result, spend and verified event history. Escape and the Close button dismiss it.
- Event history includes only records that are both verified and sourced from authoritative persisted runs. Synthetic previews and unverified records never appear as evidence.
- Empty history is explicit. Synthetic spend remains visible as currency minor units formatted for display and does not imply provider billing.
- The drawer is width- and height-bounded, scrolls internally and becomes a bottom-aligned mobile sheet without depending on hover.

The preview consumes roster and presence facts. It does not create work, authorize outreach, infer status or turn synthetic evidence into operational claims.
