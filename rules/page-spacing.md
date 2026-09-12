# Portal page spacing

Reuse the layout mixins in
`apps/portals/aggregator/application/src/pages/_page-layout.scss` for standard routed pages.

- Keep standalone page headers aligned with the existing 80px top offset. After a visible search header or local navigation, use the 24px content gap instead.
- Leave 24px between the page header and its content, and between a section title and its content.
- Separate major sections with 32px above the divider and 24px below it; do not add bottom padding that doubles the next section's gap.
- Use 16px between a card header and its content. Stack optional descriptions below the heading with an 8px gap.
- Settings pages share `_settings-page.scss`; avoid recreating card header spacing in each settings page.
- Empty optional page-header slots must not reserve space.

Use design-system spacing tokens. Keep layout in stylesheets and theme appearances in `theme.scss`.
Check desktop, tablet, and mobile when changing shared spacing. Preserve deliberate hero and reading layouts.
