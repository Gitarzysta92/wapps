# Portal page spacing

Reuse the layout mixins in
`apps/portals/aggregator/application/src/pages/_page-layout.scss` for standard routed pages.

- On desktop, keep standalone page headers aligned with the existing 80px top offset. After a visible search header, use the 24px content gap instead. At the mobile-shell breakpoint, use the shared 16px header offset.
- Mobile headers keep breadcrumbs above the title, actions beside the title, and optional section navigation below the description. Use the shared header's `navigation` slot; keep section links on one horizontally scrollable row instead of wrapping above the page.
- Leave 24px between the page header and its content, and between a section title and its content.
- Separate major sections with 32px above the divider and 24px below it; do not add bottom padding that doubles the next section's gap.
- Use 16px between a card header and its content. Stack optional descriptions below the heading with an 8px gap.
- Settings pages share `_settings-page.scss`; avoid recreating card header spacing in each settings page.
- Empty optional page-header slots must not reserve space.
- The app shell owns the 32px gap before the footer, using the existing spacing token. Do not add page-level bottom padding or margin just to separate content from the footer.

Use design-system spacing tokens. Keep layout in stylesheets and theme appearances in `theme.scss`.
Check desktop, tablet, and mobile when changing shared spacing. Preserve deliberate hero and reading layouts.
