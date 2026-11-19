# Admin welcome/dashboard

Accepted design based on the existing admin/household-editor visual language. User requested removing the old shortcut buttons and invited this design proposal.

## Presentation

- A short Norwegian welcome and three static cards: registered households, households awaiting approval, and guest-visible posts.
- Flat white cards, restrained green emphasis for pending approvals, and stacked cards on narrow screens.
- Sidebar remains the navigation. The old action buttons, publishing instructions and native dashboard collection/global shortcut tiles are removed.
- Zero is a real count. If loading fails, values are shown as unavailable rather than misleading zeros; native navigation remains usable.
- No hard-coded couple name in the welcome. The wider branding audit remains a separate backlog item.

## Ownership and safety

- `components/admin/Welcome.tsx` is the server controller for Payload's supported `admin.components.views.dashboard` slot. Payload continues to own the surrounding template, authentication hydration, breadcrumbs and navigation; do not wrap another `DefaultTemplate` around this reserved dashboard slot.
- `WelcomeView.tsx` and `welcome.module.css` own presentation. Native `Gutter` supplies horizontal page padding.
- Native administrator identity and `canAccessAdmin` are checked before counts load. Household guest sessions are not administrator identities.
- Household totals reuse the existing administrator-only summary service. Both household counts are read in one database statement. Total includes rejected households; pending counts aggregate household decisions, not individual members.
- Post counts use the shared `publishedGuestPosts` filter and native request permissions (`overrideAccess: false`). Private posts and unpublished drafts are excluded; newer draft changes do not replace the published revision.
- Counts refresh on server rendering, not through a realtime subscription. There are no new endpoints, writes, migrations or credential reads.

## Verification

- `tests/unit/admin-welcome-server.test.tsx`: administrator guard, native post permissions/filter, aggregate DTO and unavailable-count fallback.
- `tests/unit/admin-welcome-ui.test.tsx`: semantic cards, zero/error states and no dashboard actions.
- `npm run test:dashboard`: disposable database only; real counts, published-versus-draft filtering, guest isolation, preservation fingerprints, responsive screenshots and keyboard sidebar navigation.
- Existing household-admin/editor/navigation regressions cover the unchanged native shell.

Verified: 310 unit tests across 42 files; build and TypeScript; disposable dashboard suite (also independently rerun); household-admin, admin navigation, visual editor and poll integration regressions. Screenshots inspected at 320–1440px, including keyboard mobile navigation. Lint has only the four pre-existing initial-migration warnings. The populated local database was not modified.
