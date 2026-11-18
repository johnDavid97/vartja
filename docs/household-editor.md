# Household editor refinement

The administrator's individual household edit screen now matches the existing wedding admin cards, buttons and colours. Overview, shared invitation and guest registration flows are not redesigned.

## Layout and responsibilities

- `HouseholdHeading` supplies the title and saved/unsaved indicator inside native Payload document controls. Native Save, validation, permissions, locking and document actions remain intact.
- An **unnamed** contact group provides a card without nesting `contactName` or `email` in stored data.
- `HouseholdMembersField` displays an always-visible list: each row has a native name input and inline **Venter / Godkjent** radio toggles, with add/remove controls. Reordering is optional through Payload's existing `admin.isSortable` setting (default `true`); households explicitly set it to `false`, so no up/down controls are shown. It reuses Payload `RenderFields` and native array operations, preserving stable row/member IDs and field permissions without a second form state. Narrow screens wrap the controls within each row.
- `HouseholdMemberStatusField` supports keyboard radio navigation and follows Payload's live field path when rows move. Status changes remain unsaved until **Lagre**.
- `HouseholdApprovalField` writes only native form state via `useField`. Approve, reject and pending choices take effect only on **Lagre**. Read-only and disabled form states are respected. Existing collection approval hooks are unchanged.
- `HouseholdStatusBadge` shares the overview's existing presentation rules and CSS across the table, header and approval card.
- The code panel stays separate from form persistence. Reveal/copy/replace retain the existing authenticated endpoints, audit trail and confirmation. A new Hide action clears the displayed code. Copy explicitly explains that replacement is immediate and does not require Save.
- Desktop uses two columns; smaller screens stack the cards. A redundant single native edit tab is hidden only on this document type; multiple tabs would remain visible.

No new endpoint, database migration, guest permission or approval rule was introduced. Generated household types retain the same field shape.

## Verification

- 212 unit tests (including sortable, non-sortable and default component configuration), strict TypeScript, production build and lint (only four pre-existing migration warnings).
- Isolated PostgreSQL/browser registration suite: initial approval; unsaved approval/rejection; contact/member edits; stable member IDs and order; no reorder controls for households; persisted add/remove; new members pending; keyboard toggles and individual approval; rejection/reapproval; reveal/copy/hide; cancellation and confirmed immediate code replacement; existing credential and access regressions.
- Existing household admin, native admin, visual editor and poll browser suites pass against a disposable database and production server.
- Screenshots reviewed at 320, 390, 768, 1024 and 1440px. Tests check page width, card gutters, desktop overlap and account-link visibility.
- Independent read-only review reported no actionable findings in the scoped changes.

Implemented on `feature/household-editor-design`.
