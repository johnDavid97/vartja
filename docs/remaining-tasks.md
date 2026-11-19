# Remaining VårtJa tasks

User-provided task order. Work on one item at a time; this list supersedes the assistant's earlier suggested order. Do not expand scope without discussion.

1. **Guest login UI — completed:** visually aligned with admin login, simplified heading/help text, and removed the anonymous homepage login section. Household name/code authentication, approval and session behaviour remain unchanged. Verified with unit, build/type/lint, browser and isolated login/homepage regressions.
2. **Household member editing UI — completed and accepted:** admin editor follows `husstand-rediger.pdf`, retaining Husstandsnavn. Individual Venter/Godkjent/Avslått decisions derive household status; Godkjenn alle includes rejected members and requires Lagre. See [household-editor.md](household-editor.md) for verification and migration details.
3. **Posts page UI — completed and accepted:** article follows `Nettside-innlegg.pdf`; overview reuses the Flere innlegg card grid. Both lists use newest publication first; related cards exclude the current article. Shared comments also restyled on posts and Program. See [posts presentation](../features/posts/README.md).
4. **Poll UI — completed and accepted with item 3:** shared guest poll styling follows the same PDF on posts and Program, preserving existing ballot identities and explicit Stem submission. Further poll changes require a separately agreed scope.
5. **Admin welcome/dashboard:** improve the welcome page; agree on the information/actions it should prioritise.
6. **Andrea & Martin after the domain as a suffix:** clarify the exact requested URL/domain structure before choosing an implementation. Do not assume this means a page-title suffix or a multi-wedding architecture.
7. **Dynamic wedding branding:** replace hard-coded couple names and monograms (including the admin login logo) with the configured wedding identity. Audit admin navigation, welcome text and page titles for the same issue. Reuse one source of truth and define sensible fallbacks. This is separate from the URL/domain task and was not included in the completed login styling work.

Post comments and items 1–4 are completed and accepted, including the display-only duplicate-cover fix. Next is **5 — admin welcome/dashboard**, requiring design/scope confirmation. The task list does not itself authorize commits or pushes for subsequent work.
