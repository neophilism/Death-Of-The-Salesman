# Searchable agent roster

DOTS-023 replaces the fixed two-card preview with a bounded, searchable roster surface.

- Search matches an agent's name, role, assigned model, availability and visible status label.
- The status filter distinguishes running, waiting and inactive records. Text remains visible beside every status light.
- Pagination renders at most 24 identities at once. A 2,000-record synthetic test verifies deterministic page boundaries without mounting all records.
- Each tile exposes a unique accessible name and description. Arrow keys move between visible tiles; Home and End move to the first and last visible tile.
- Previous and Next are native buttons with explicit disabled states. Filter changes return to the first page.
- Model and availability are visible facts. Synthetic preview records do not imply a provisioned provider, active worker or outbound authority.

The roster consumes status evidence but does not derive it. DOTS-022 remains the authority for running, waiting and inactive state. DOTS-024 owns the expanded detail preview.
