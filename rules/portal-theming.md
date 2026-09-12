# Aggregator portal theming

Define aggregator portal theme tokens and themed appearance rules in
`apps/portals/aggregator/application/src/theme.scss`.

- Keep light and dark variants, including navigation hover, focus, and active states, in that file.
- Do not move these portal theme definitions into `libs/ui/design-system`, component stylesheets, or inline styles.
- Components should consume the theme's CSS custom properties and appearance names. Keep component-specific layout in component stylesheets.
- Reuse existing design-system primitives such as colors, spacing, and typography when defining the portal theme.

For example, navigation's fading hover gradient and stronger active gradient are defined in `theme.scss`.
