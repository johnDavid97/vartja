# Remaining VårtJa tasks

User-provided task order. Work on one item at a time; this list supersedes the assistant's earlier suggested order. Do not expand scope without discussion.

1. **Guest login UI — completed:** visually aligned with admin login, simplified heading/help text, and removed the anonymous homepage login section. Household name/code authentication, approval and session behaviour remain unchanged. Verified with unit, build/type/lint, browser and isolated login/homepage regressions.
2. **Household member editing UI:** reference design is on Elise's PC. Obtain the design and confirm the intended editing surface before implementing.
3. **Posts page UI:** obtain/confirm the intended design and whether the change concerns the overview, article page or both.
4. **Poll UI:** confirm the desired presentation, then reuse the shared implementation across surfaces.
5. **Admin welcome/dashboard:** improve the welcome page; agree on the information/actions it should prioritise.
6. **Andrea & Martin after the domain as a suffix:** clarify the exact requested URL/domain structure before choosing an implementation. Do not assume this means a page-title suffix or a multi-wedding architecture.
7. **Dynamic wedding branding:** replace hard-coded couple names and monograms (including the admin login logo) with the configured wedding identity. Audit admin navigation, welcome text and page titles for the same issue. Reuse one source of truth and define sensible fallbacks. This is separate from the URL/domain task and was not included in the completed login styling work.

Post comments and guest login UI are implemented and verified. Next implementation item: **2 — household member editing UI**, awaiting the reference design and editing-surface clarification. The task list does not itself authorize commits or pushes for subsequent work.
