# Responsive workspace navigation

DOTS-017 adds a reusable client-side workspace frame around the synthetic preview.

## Interaction contract

- The desktop side navigation is a named landmark with a real button that exposes its expanded state and controlled region.
- Project search has a persistent label and uses the native search input contract.
- Notifications announce the unread count in the button name; the visual badge is decorative.
- User controls use a native disclosure so keyboard activation and focus behavior do not depend on hover.
- At 768 px and below, the side navigation is replaced by fixed, labeled mobile tabs. Content retains bottom clearance for the tab bar.
- Layout rules explicitly cover 1440 px through the desktop default plus 1024, 768, 390, and 320 px constraints. Flexible tracks and min-width guards prevent horizontal clipping.

The links and controls remain preview-only. They do not claim persisted projects, authenticated users, notifications, or operational actions.
