# Future considerations

Non-blocking limitations to revisit as the website evolves. These are not commitments to implement new features.

## Poll overview: server-side filtering and pagination

**Current behaviour:** The overview loads all relevant posts and aggregated poll results on the server, then sends the complete overview to the browser for search, filtering and pagination. Posts are fetched in batches, but those batches are combined in memory; displaying 20 rows per page does not limit the total data loaded.

**Why this is acceptable now:** The wedding website is expected to have a small number of posts and polls. Ballots are aggregated in the database; individual votes and voter identifiers are not sent to the browser.

**When to revisit:** If the number of posts or polls grows substantially, or measurements show slow overview loading, large response payloads or excessive server/browser memory use.

**Possible next step:** Move search, status filtering and pagination to the server, returning only the requested page and matching total. Consider an indexed poll projection if extracting polls from post bodies becomes expensive. Do not silently cap the data and show incomplete results.

**Preserve:** Administrator-only access, published-versus-draft distinctions, archived results, and accurate vote totals. Add tests covering multiple pages and filtering across the full dataset.

Implementation details: [Poll overview](../features/polls/README.md).
