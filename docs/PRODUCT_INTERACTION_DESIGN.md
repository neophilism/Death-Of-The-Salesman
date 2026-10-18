# Product Interaction Design — Death Of The Salesman
Version 1.0 — 2026-10-18 — Approved visual direction specification (not yet implemented)

## Reference fidelity
Implement the previously presented **first** dark dashboard as the primary visual reference: navy/charcoal surfaces, thin subtle outlines, bright blue/teal/violet highlights, high-information cards, side navigation and assignment columns. Replicate its information architecture and proportions, NOT literal fake metrics, brand slogans, invented interaction states, or random inspirational sales quotes. **Remove the bottom-left corner quote entirely**. No salesman quotes should appear anywhere as decoration. Any future textual branding/tagline can be owner-configured and is blank by default.

## Owner journeys
1. Overview: see real verified total agents, green/yellow/red state breakdown, active campaigns, budget used and remaining, contacts, replies, deals and received net revenue. Default to a curated last-7-day window, switchable.
2. Deployment: checkbox choose which projects/buckets are visible. Drag available agent chip (or keyboard/tap assign) to chosen buckets; assign multiple campaigns with percentage allocation, capacity and priority. Show a toast only after API confirmation; optimistic UI rolls back on conflict.
3. Agent status: colored light at top-right of *both* roster chip and expanded hover/drawer, plus readable text. Green if active valid run with heartbeat, amber for scheduled/waiting/approval/reply/budget, red if inactive/disabled/unhealthy. Hover peeks current work, strategy, model, timestamps, verified outcomes and expenses. Clicking shows a full timeline and actionable owner controls. The first two named agent examples are Fast Eddie Felson and Harry Wormwood.
4. Sales campaign: selectable product/offer, prospects, target personas, approved factual claims, suggested pitches, strategy mix, outbound sender, cadence, schedule, budget and message templates; live preview and approval workflow.
5. Funding: investor opportunities and grant opportunities use separate pipeline semantics; grant opportunity cards have eligibility, deadline, required files, requested amount, submit-for-review and receipt state; investor cards never confuse interested lead with funded transaction.
6. Conversation Center: visual inbox with thread avatars and cards. On mobile, tap into a single conversation. Owner can see full chronological replies, edit a draft, approve the precise draft, respond manually, reassign, pause or unsubscribe. Distinguish drafted/sent/provider accepted/confirmed delivered/bounced, and show exact evidence.
7. Strategy Lab: champion versus exploratory ratio slider (initial sample 50/50), campaign-scoped, per-model/per-strategy performance cards, lift and sample size, variant editing, experiment archive, rollback, model routing and cost by outcome. Different UI controls for strategy mix and model mix.
8. Budget Center: visually allocate campaign funds with movable sliders plus exact currency-input field, available vs reserved vs spent, caps and owner approval; explicit refusal at $0.
9. Owner Action Review and Audit: concise cards with urgency, exact requested action, capability/cost consequences and validated evidence; no forced giant tables for routine workflow.

## Shell and components
- Desktop: collapsible sidebar (Overview, Deployment, Pipeline, Conversations, Funding, Strategy Lab, Campaign Studio, Agents, Budgets, Actions & Audit, Settings); top search and alerts, account controls; main pane.
- Deployment layout large >=1280: left roster 280 px (min 240), center 2–4 project-column card grid, right inspector 300–360 px as optional dock/drawer. With sidebar collapsed, maximize bucket width.
- Responsive 768–1279: project columns in scroll/2 column layout, roster and inspector in slideouts; tablet touch supports drag-and-drop or assign menu.
- Small <768: one focused page at a time, tabs for critical screens, stacked bucket cards, accessible tap/keyboard assignment, no hover-only actions.
- Cards: 12–18 px radius, 1 px subdued line, 12–20 px internal spacing, typographic hierarchy, purposeful icons; color is secondary to explicit labels.
- Status chip overlay top-right; expanded hover card position avoids clipping/scroll overflow, never crosses viewport boundary.
- Visuals must be grounded: charts from server metrics, no invented revenue values, placeholder data explicitly "Demo". Tooltips show metric definition and attribution confidence.
- Original/rights-cleared portrait or monogram fallback; don't bundle copyrighted actor images without rights.
- No animation essential to understanding; honor reduced-motion. 44x44 touch targets, full keyboard operations, WCAG 2.2 AA contrast, focus and aria live region testing.
- Tokenized theme, supports dark default, accessible light variant, compact/comfortable density. Persist personal UI preferences per organization/user.
- Screenshot/golden-image tests desktop 1440, laptop 1024, tablet 768, mobile 390 and narrow 320 px. Test long names and RTL resilience where supported.

## Design acceptance criteria
- Screenshot comparison demonstrates near-reference layout on desktop and deliberate, functional reflow at all tested breakpoints.
- Corner quote absent.
- Status from actual backend heartbeat, with reason and timestamps visible by hover, focus or tap.
- Assign and unassign agent to checked bucket via mouse, touch and keyboard.
- Edit strategy allocation, prospect communication, draft and campaign budget and observe persisted changes, approval and error handling.
- UI operations never directly invoke a paid model without an explicitly authorized action, and no fictional performance numbers on production screens.
