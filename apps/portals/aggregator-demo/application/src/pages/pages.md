# **Page Development Guidelines for Junior Developers**

## **Before You Start**

When creating a new page, always:
1. **Study existing similar pages first** - Look at pages that share similar functionality
2. **Understand the data flow** - Know where your data comes from and how it loads
3. **Plan your layout sections** - Sketch or list the sections your page will have
4. **Check the design system** - Familiarize yourself with available components and utilities

---

## **1. Component Architecture Rules**

### **Essential Setup**
- **Always use standalone components** - Set `standalone: true` in your component decorator
- **Explicitly import everything** - Never rely on module-level imports; list every component, directive, and pipe you use
- **Implement routing interfaces** - Use `routingDataConsumerFrom<T>` to properly type your route data inputs
- **Keep one component per folder** - Each page component lives in its own folder with `.ts`, `.html`, and `.scss` files

### **Data Management Philosophy**
- **Use `rxResource` for all async operations** - This handles loading states automatically
- **Never subscribe manually in pages** - Let Angular's reactive primitives handle subscriptions
- **Use `computed()` for calculations** - Any derived or transformed data should be a computed signal
- **Use `input()` for component inputs** - This is the modern Angular signal-based approach
- **Keep business logic out of templates** - Complex calculations belong in the component class

### **State Management Guidelines**
- **Resource pattern**: Use for data that loads based on a request (apps, discussions, etc.)
- **Computed pattern**: Use for transforming or combining data you already have
- **Never mutate data directly**: Always create new objects/arrays when transforming data
- **Handle all states**: Always consider loading, success, error, and empty states

---

## **2. Template Structure Principles**

### **Page Header (Required for All Pages)**
Every page MUST start with a consistent header structure:

1. **Top bar slot**: Always shows breadcrumbs with skeleton during loading
2. **Title slot**: Page title (usually H1) with optional icon, skeleton during loading
3. **Meta slot**: Secondary information like stats or badges, skeleton during loading

**Rules:**
- Always provide skeleton variants for loading states
- Use control flow (`@if`) to toggle between loading and loaded states
- Icons should come from Taiga UI icon set (prefix: `@tui.`)
- Never skip the header structure, even if some slots are empty

### **Section Organization**
Break your page into logical sections following these patterns:

**Pattern 1: Using commonSection directive**
- For sections that fit the standard header + content structure
- Always use `slot="header"` and `slot="content"`
- Include icons in section titles for visual interest
- Use `uiSectionTitle` directive on title elements

**Pattern 2: Custom sections**
- For sections needing unique layouts (grids, special styling)
- Start with a styled title that includes visual accent (like accent bars)
- Wrap content in semantic containers
- Always add a descriptive class name for styling

**General Section Rules:**
- One main concern per section
- Always separate sections with appropriate spacing
- Use `<ui-divider />` between major content areas when needed
- Keep section content focused and scannable

### **Loading State Philosophy**
**Golden Rule: Never show raw loading or "undefined" to users**

For every async operation:
1. Show skeleton placeholders during loading
2. Use `@for` loops with array literals to show multiple skeletons: `@for (item of [1, 2, 3]; track item)`
3. Match skeleton count to expected content count (or use a reasonable default like 2-3)
4. Skeletons should visually approximate the real content's size and position

---

## **3. Styling Guidelines**

### **Design System First Approach**
**ALWAYS start your SCSS file with:**
```scss
@use 'ui/design-system/src/styles' as *;
```

**This gives you access to:**
- Spacing variables (never use hardcoded pixel values)
- Typography scales (never use hardcoded font sizes)
- Color tokens (never use hex colors directly)
- Layout utilities (breakpoints, z-index scales, etc.)
- Mixins (skeleton shimmer, etc.)

### **Spacing Rules**
- **Use the spacing scale**: `$space-1` through `$space-20`
- **Common patterns:**
  - Page headers: `margin-top: $space-20`
  - Between major sections: `margin-top: $space-12`, `padding: $space-8 0`
  - Between related items: `margin-top: $space-6`
  - Grid gaps: `gap: $space-6` (larger) or `gap: $space-4` (smaller)
  - Inline element gaps: `gap: $space-3` or `gap: $space-2`
- **Never use arbitrary values**: If you think you need `margin-top: 17px`, you're doing it wrong

### **Typography Rules**
- **Font sizes**: Use `$font-size-xl`, `$font-size-lg`, `$font-size-md`, `$font-size-sm`, `$font-size-xs`
- **Line heights**: Use `$line-height-tight`, `$line-height-normal`, `$line-height-loose`
- **Font weights**: Use `$font-weight-bold` (we mainly use normal and bold)
- **Text overflow**: Use the line-clamp pattern for multi-line truncation (see existing examples)

### **Color and Theming Rules**
- **Always use CSS custom properties**: `var(--tui-text-primary)`, `var(--tui-primary)`, etc.
- **Provide fallbacks when needed**: `var(--tui-base-03, #{$color-border})`
- **Common color variables:**
  - `--tui-text-primary`: Main text color
  - `--tui-text-secondary`: Muted/meta text
  - `--tui-primary`: Brand primary color
  - `--tui-accent`: Accent highlights
  - `--tui-positive`: Success/positive states
  - `--feed-background`: Background for feed-like sections
  - `--elevated-background`: Background for cards/elevated surfaces

### **Responsive Design Rules**
- **Mobile-first approach**: Write base styles for mobile, enhance for desktop
- **Use the breakpoint variables**: `@media #{$layout-breakpoint-md}`, `@media #{$layout-breakpoint-sm}`
- **Common pattern**: Switch from grid to single column on mobile
- **Test at 375px, 768px, and 1440px** as key breakpoints
- **Make sticky elements relative on mobile**: Sticky positioning often breaks mobile UX

### **Grid Layout Guidelines**
- **Use auto-fit for flexible grids**: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`
- **Adjust minimum column width** based on content (280px-320px is typical for cards)
- **Always provide mobile override**: Single column layout for narrow screens
- **Use gap instead of margin**: Grid gap is cleaner than item margins

---

## **4. Component Import Strategy**

### **Import Organization**
Organize imports in this order:
1. **Angular core**: `Component`, `inject`, `computed`, `input`, etc.
2. **Angular common**: `CommonModule`, pipes, etc.
3. **RxJS**: `of`, `delay`, `map`, etc.
4. **Taiga UI**: Core components, then kit components
5. **UI library**: Layout components, then feature-specific components
6. **Domain models**: Types and DTOs
7. **Local**: Navigation, utils, etc.

### **What to Import From Where**

**Taiga UI (`@taiga-ui/core` and `@taiga-ui/kit`):**
- Basic interactive elements: `TuiButton`, `TuiIcon`
- Visual markers: `TuiBadge`, `TuiChip`, `TuiAvatar`
- Appearance directive: `TuiAppearance`

**UI Library (`@ui/*`):**
- **Layout components**: Page structure, sections, cards, dividers
- **Feature components**: Breadcrumbs, tags, navigation elements
- **Always import both component and skeleton**: If you import `BreadcrumbsComponent`, also import `BreadcrumbsSkeletonComponent`

**Shared Features (`@portals/shared/features/*`):**
- **Domain-specific components**: Discussion cards, feed items, search components
- **Business logic components**: These contain domain knowledge about discussions, reviews, etc.

**Domain Models (`@domains/*`):**
- **Type definitions only**: Never import logic from domain packages
- **DTOs and enums**: For typing your data structures

---

## **5. Taiga UI Appearance System**

### **Understanding Appearances**
Appearances are pre-styled variants applied via the `tuiAppearance` directive. Think of them as semantic style presets.

### **Common Appearance Categories**

**Card Appearances:**
- `card-elevated`: Standard elevated card with shadow
- `card-author`: Special styling for author/user cards
- `card-author-featured`: Highlighted variant for featured authors

**Accent/Decoration Appearances:**
- `accent-bar-indigo`: Thick accent bar (usually for section titles)
- `accent-bar-warm`: Warm-colored accent bar
- `accent-strip-indigo`: Thin decorative strip (usually for card top edge)

**Badge/Label Appearances:**
- `badge-gold`, `badge-silver`, `badge-bronze`: Tier-based badges
- `rank-badge`, `rank-badge-gold`: Ranking indicators
- `tag-gradient`: Gradient-styled tags

**Button Appearances:**
- Use the `appearance` attribute (not `tuiAppearance`) on buttons
- Options: `primary`, `secondary`, `action-soft`, `error`, `neutral`

### **When to Create New Appearances**
**Don't create new appearances unless:**
- You're creating a reusable pattern used across multiple pages
- You've discussed it with the team
- You've added it to the design system documentation

**Instead, use classes for page-specific styling**

---

## **6. Slot-Based Composition**

### **Why Slots Matter**
Slots let parent components control where child content appears without the child knowing the layout details.

### **Common Slot Names**
Memorize these standard slot names:
- `top-bar`: Usually for breadcrumbs or back navigation
- `top-edge`: Decorative element at card top (chips, strips)
- `header`: Main header area
- `title`: Title within a header
- `meta`: Metadata/secondary info
- `content`: Main content area
- `bottom-bar`: Stats or meta info at bottom of content
- `footer`: Final row of card (actions, tags)
- `left`, `right`: For horizontal layouts

### **Best Practices**
- **Don't nest slots unnecessarily**: Keep slot structure flat
- **Use semantic slot names**: The name should describe the purpose, not the styling
- **Always check component definition**: Look at the component's template to see what slots it expects
- **Don't put non-slotted content in slot-only components**: If a component uses slots, you must use them

---

## **7. Navigation and Routing**

### **Always Use Path Builders**
- **Never hardcode URLs**: Use `buildRoutePath()` helper
- **Pass all required parameters**: Check the navigation definition for required params
- **Example pattern**: `buildRoutePath(NAVIGATION.application.path, { appSlug: app.slug })`

### **Navigation Method Pattern**
Create methods for navigation logic:
- Keep navigation logic out of templates
- Name methods descriptively: `navigateToDiscussion()`, not `handleClick()`
- Use the router service: Inject `Router` and call `navigate()`
- Make cards clickable with `(click)` and `cursor: pointer`

### **Breadcrumb Handling**
- Breadcrumbs come from route data
- Use `replaceBreadcrumbLabels()` utility to substitute dynamic values
- Define `NAVIGATION_NAME_PARAMS` constants for placeholders
- Always wait for data to load before replacing breadcrumb labels

---

## **8. Interactive Patterns**

### **Clickable Cards**
When making cards clickable:
1. Add click handler to the card element
2. Add `cursor: pointer` in CSS
3. Consider hover states for better UX
4. Make the entire card the click target (don't rely on small buttons)

### **Button Actions**
- Primary actions get `appearance="primary"`
- Secondary/subtle actions get `appearance="action-soft"`
- Destructive actions get `appearance="error"`
- Always include icon for visual clarity
- Button text should be action-oriented ("Start Discussion", not "Click Here")

### **Stats and Metrics Display**
- Always pair icons with numbers
- Use consistent icon sizing (`$size-icon-xs` for inline stats)
- Use muted colors for stats (`--tui-text-secondary`)
- Group related stats together with flexbox
- Keep stat text concise ("5 replies" not "Number of replies: 5")

---

## **9. Class Naming Conventions**

### **BEM-Inspired Pattern**
We use a BEM-inspired (Block Element Modifier) naming:

**Structure:**
- **Block**: `.component-name` or `.section-name`
- **Element**: `.block__element`
- **Modifier**: `.block--modifier`

**Examples:**
- `.page-header`
- `.related-discussions__title`
- `.related-discussions__grid`
- `.changelog-card--compact`
- `.top-authors__stat-icon`

### **Naming Rules**
- **Use kebab-case**: `changelog-card`, not `changelogCard` or `changelog_card`
- **Be descriptive**: Name should indicate purpose
- **Follow the hierarchy**: Classes should reflect HTML structure
- **Avoid generic names**: `.container`, `.wrapper` are too vague
- **Co-locate styles**: All styles for a section should use a common prefix

---

## **10. Common Patterns Reference**

### **The Skeleton Pattern**
**When:** Any time data loads asynchronously
**How:** 
- Check if resource `isLoading()`
- Show skeleton component with same layout as real content
- Use `@for` loop to show multiple skeletons
- Transition smoothly to real content when loaded

### **The Stats Badge Pattern**
**When:** Showing metrics (views, replies, participants)
**How:**
- Icon + number + label in a flex container
- Use secondary text color
- Small icon size
- Space multiple stats with consistent gap

### **The Section Title with Accent Pattern**
**When:** Starting a major page section
**How:**
- H2 or H3 with flexbox layout
- Include `<span tuiAppearance="accent-bar-*">` as first child
- Small gap between accent and text
- Use `$font-size-xl` and `$font-weight-bold`

### **The Grid + Mobile Column Pattern**
**When:** Showing multiple cards or items
**How:**
- Desktop: `repeat(auto-fit, minmax(Xpx, 1fr))`
- Mobile: Override to `grid-template-columns: 1fr`
- Consistent gap throughout

### **The Computed Breadcrumb Pattern**
**When:** Breadcrumbs contain dynamic data
**How:**
- Accept breadcrumb input from route
- Wait for data to load in computed
- Use replacement utility with param map
- Return transformed breadcrumb array

---

## **11. Common Mistakes to Avoid**

### **Data Management Mistakes**
- ❌ Subscribing manually in page components
- ❌ Not handling loading states
- ❌ Forgetting to track items in `@for` loops
- ❌ Using `any` type without a good reason
- ❌ Putting API calls directly in components

### **Styling Mistakes**
- ❌ Hardcoding pixel values instead of using design tokens
- ❌ Using inline styles
- ❌ Not providing responsive behavior
- ❌ Forgetting to import the design system
- ❌ Using absolute positioning when grid/flex would work
- ❌ Not testing on mobile viewport

### **Template Mistakes**
- ❌ Not providing skeleton loading states
- ❌ Forgetting `track` in `@for` loops (causes re-render issues)
- ❌ Putting complex logic in templates (use computed instead)
- ❌ Not using slots when the component expects them
- ❌ Deeply nesting conditional statements (flatten with early returns)

### **Component Mistakes**
- ❌ Not importing components you use (will fail silently in standalone)
- ❌ Forgetting to add components to imports array
- ❌ Not making component standalone
- ❌ Mixing old and new syntax (don't use `@Input()` with `input()`)

---

## **12. Development Workflow**

### **Step-by-Step Page Creation**

**1. Study Phase (15-30 min)**
- Find 2-3 similar existing pages
- Read through their TypeScript, HTML, and SCSS
- Identify patterns that apply to your page
- Note any unique requirements

**2. Setup Phase (10 min)**
- Create component folder
- Generate or create `.ts`, `.html`, `.scss` files
- Set up component decorator with `standalone: true`
- Import `CommonModule` and routing interface

**3. Data Phase (20-30 min)**
- Identify all data sources needed
- Create `rxResource` for each async source
- Create `computed` for any derived data
- Add proper TypeScript types
- Test loading states

**4. Template Phase (30-60 min)**
- Build page header with all three slots
- Add skeleton variants
- Create section structure
- Wire up data bindings
- Test all loading states

**5. Styling Phase (30-45 min)**
- Import design system
- Style from top to bottom
- Use design tokens exclusively
- Add responsive breakpoints
- Test on mobile

**6. Polish Phase (15-30 min)**
- Add click handlers and navigation
- Test all interactive elements
- Verify skeleton loading looks good
- Check accessibility (contrast, focus states)
- Clean up console logs and TODOs

**7. Review Phase (15 min)**
- Compare with similar pages for consistency
- Check all imports are used
- Verify no hardcoded values
- Test on multiple screen sizes
- Read through code one more time

---

## **13. Testing Checklist**

Before marking your page as complete:

**Visual Testing:**
- [ ] Page looks correct at 375px (mobile)
- [ ] Page looks correct at 768px (tablet)
- [ ] Page looks correct at 1440px (desktop)
- [ ] Skeleton loading states look reasonable
- [ ] No layout shift when content loads
- [ ] No content overflow or horizontal scroll
- [ ] Spacing looks consistent

**Functional Testing:**
- [ ] All navigation links work
- [ ] Breadcrumbs show correct path
- [ ] Loading states appear and disappear correctly
- [ ] Click handlers work as expected
- [ ] Data loads and displays correctly

**Code Quality:**
- [ ] No TypeScript errors
- [ ] No unused imports
- [ ] No console errors or warnings
- [ ] Follows naming conventions
- [ ] Uses design tokens (no hardcoded values)
- [ ] Includes comments for complex logic

---

## **14. When to Ask for Help**

**You should ask questions when:**
- You can't find an existing pattern for what you need
- You're about to create a new reusable component
- You're not sure which component to import
- Your code works but feels too complicated
- You're stuck on the same problem for more than 30 minutes
- You need to deviate from these guidelines

**How to ask effectively:**
- Show what you've tried
- Reference similar existing pages
- Explain what you expect vs. what you're getting
- Share your code (component + template + styles)

---

## **15. Quick Reference**

**Most Common Imports:**
- Taiga UI: `TuiButton`, `TuiIcon`, `TuiAppearance`, `TuiBadge`, `TuiChip`
- Layout: `PageHeaderComponent`, `CommonSectionComponent`, `MediumCardComponent`
- Utilities: `BreadcrumbsComponent`, `TagsComponent`
- Angular: `CommonModule`, `computed`, `input`, `inject`

**Most Common Design Tokens:**
- Spacing: `$space-6`, `$space-8`, `$space-12`, `$space-20`
- Typography: `$font-size-xl`, `$font-size-md`, `$font-size-sm`
- Colors: `var(--tui-text-primary)`, `var(--tui-text-secondary)`

**Most Common Patterns:**
- Resource loading: `rxResource({ request, loader })`
- Computed values: `computed(() => { ... })`
- Loading check: `@if (data.isLoading()) { skeleton } @else { content }`
- Grid: `repeat(auto-fit, minmax(280px, 1fr))`

---

**Remember:** Consistency is more important than cleverness. When in doubt, copy an existing pattern rather than inventing a new one!

