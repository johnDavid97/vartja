# Household editor

The administrator's household edit screen follows `husstand-rediger.pdf`. The approved extension keeps **Husstandsnavn** above a paired **Kontaktperson / E-post** row. Overview, shared invitation and guest registration flows are not redesigned.

## Member decisions and household access

Each member has **Venter / Godkjent / Avslått** (`pending / approved / revoked`). Household status is derived:

- At least one approved member → approved household.
- No approved members, but at least one pending → pending household.
- Everyone rejected → rejected household.

`deriveHouseholdStatus` is the shared pure rule. The collection derives and persists household status from validated members, ignoring submitted household status. A status-only API update is not a bulk command. **Godkjenn alle** explicitly updates all member fields, including rejected members, in native form state; changes take effect only on **Lagre**.

Removing the last approved member can withdraw access. Existing sessions are invalidated when approval is lost or a household becomes rejected. Reapproval does not resurrect old sessions. Changing one member leaves household sessions valid if another member remains approved. Registration still creates pending members; administrator creation still creates approved members. Name corrections preserve decisions, and additions default to pending.

## Layout and responsibilities

- `HouseholdHeading` shows the live household name and derived status, with unsaved changes indicated separately. Payload owns Save, validation, permissions, locking and document actions.
- The unnamed contact group does not nest persisted fields. Household name spans both desktop columns; contact name/email share the next row and stack on mobile.
- `HouseholdMembersField` keeps native `RenderFields`, array operations and stable row/member IDs. Flat rows have initials, names, three-state radio choices and remove controls. The card shows an approved count and explicit approve-all action. Read-only and child status permissions apply to bulk actions too.
- `HouseholdMemberStatusField` uses keyboard-accessible native radios. Rejected members remain visible/editable, rather than being deleted.
- `householdFormPresentation` selects live member fields without introducing competing form state. Initials reuse the shared presentation helper.
- `HouseholdApprovalField` retains native field registration/error handling but does not present an independent approval control or mark the form modified on mount.
- The code panel provides eye reveal/hide, copy, confirmed immediate replacement and document timestamps. Existing authenticated endpoints and credential auditing are unchanged. Revealed codes remain in component memory and clear on document navigation.
- **Deletion remains in Payload's native document-action menu**, rather than the PDF's sidebar link. The installed public UI API does not export its native deletion component; no private import or parallel deletion workflow was introduced.

No guest self-service endpoint was added. The deferred edit-details service now derives status after member reconciliation; any future repository implementation must atomically persist status and session-version consequences alongside revision checks.

## Migration and compatibility

`20261119_120845_household_member_rejection` adds the rejected member enum value. Enum recreation allows legacy rejected households to be backfilled to rejected members within the same transaction. Household status, credentials, IDs and versions are preserved.

The migration refuses inconsistent legacy approvals (including empty households) rather than silently granting or withdrawing access. Review such records explicitly before retrying. Rollback refuses when rejected members exist, since reverting would otherwise lose their decisions.

Back up populated databases and apply only this outstanding reviewed migration. Never replay initial migrations against populated databases.

## Verification

- 282 unit tests pass, including all aggregate-status combinations, empty lists, rejected-name preservation, removal of the last approved member, native UI controls and read-only/permission states. Build and TypeScript pass; lint has only four existing initial-migration warnings.
- `npm run test:household-members`: production build, disposable migration/rollback/backfill checks, editor/registration, login/Program and admin/editor/poll regressions. Suites use separate databases because registration deliberately exhausts durable quotas.
- Browser checks cover individual/bulk approval and rejection, save-only persistence, contradictory status submissions, session revocation/reapproval, credential rotation/auditing, stable IDs and 320–1440px layouts. Desktop assertions verify full-width household name and paired contact/email fields.
- An older visual-editor assertion was scoped to the article body so the separately added comments heading does not count as saved rich-text content.
- Independent read-only review found no blocking issues. All 14 browser smoke checks pass; separate disposable Program-activity and post-comment suites confirm access withdrawal still protects their endpoints.
- The local migration was applied after a private backup, with all existing table-content fingerprints unchanged. Its operational helper timed out during cleanup after reporting success; a separate connection confirmed the committed migration record and enum. No initial migrations were replayed.
