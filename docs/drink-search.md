# Drink search

The tracker searches the curated local catalog instantly. Selecting a local drink
opens the same editable volume and ABV form as the generic Beer selection, with
the drink's catalog defaults filled in. **Search more drinks**
adds up to 20 matching alcoholic products from Open Food Facts. Selecting a
product opens a confirmation form: adjust the default 12 oz amount consumed and
confirm its label ABV. Missing ABV stays blank. Package quantities are displayed
for identification only and never used as the consumed amount.

No API key or database migration is needed. Development and tests use the Open
Food Facts staging host (`world.openfoodfacts.net`); production uses
`world.openfoodfacts.org`. Full-text search uses `/cgi/search.pl` because the v3
product API does not support search. Local and custom logging remain available
when the upstream is slow or unavailable.

Search runs only on button press. The server coalesces simultaneous identical
queries, caches up to 100 queries for one hour, times out after ten seconds, and
limits uncached requests to ten per minute per server instance. This limit is
in-memory, not shared across deployment instances; higher traffic would need
shared rate limiting to enforce the upstream's per-IP budget across instances.

Results remain separate from the curated catalog and include Open Food Facts
attribution and an ODbL link. No product images are imported.

References: [API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)
and [data reuse terms](https://world.openfoodfacts.org/terms-of-use).
