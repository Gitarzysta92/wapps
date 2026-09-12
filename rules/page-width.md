# Portal page width

The app shell owns the portal's responsive content width and sidebar layout.
Routed pages should fill that content column, using a block host with `min-width: 0`.

Keep page headers, content sections, cards, and action rows aligned to that column.
Do not add independent fixed pixel widths or maximum widths to whole page sections,
such as different limits for each settings page. A deliberately narrow element
(for example, an article's reading measure) may have its own constraint without
changing the width of the entire page.

Component layout belongs in component stylesheets; theme tokens and appearance
rules remain in `apps/portals/aggregator/application/src/theme.scss`.

Verify desktop, tablet, and mobile layouts when changing page-width behavior.
