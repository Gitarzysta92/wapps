# UI Content Library

A centralized library for content-styling components in the UI layer.

## Purpose

This library groups components related to styling textual and visual content, providing a clear separation from structural layout components. It focuses on **how content is presented** rather than **how components are arranged**.

## Components

### Excerpt Components
- `ExcerptComponent` - Displays text excerpts with optional truncation
- `ExcerptSkeletonComponent` - Loading skeleton for excerpts

### Title Components
- `MediumTitleComponent` - Component for styling medium-sized titles
- `MediumTitleSkeletonComponent` - Loading skeleton for medium titles

## Usage

### Basic Title Usage

```typescript
import { MediumTitleComponent } from '@ui/content';

@Component({
  // ...
  imports: [MediumTitleComponent]
})
export class MyComponent {}
```

```html
<ui-medium-title>{{ article.title }}</ui-medium-title>
```

### Excerpt Usage

```typescript
import { ExcerptComponent } from '@ui/content';

@Component({
  // ...
  imports: [ExcerptComponent]
})
export class MyComponent {}
```

```html
<ui-excerpt [excerpt]="article.excerpt" [maxLength]="200" />
```

### With Skeletons

```typescript
import { 
  MediumTitleSkeletonComponent,
  ExcerptSkeletonComponent 
} from '@ui/content';
```

```html
@if (loading) {
  <ui-medium-title-skeleton />
  <ui-excerpt-skeleton />
} @else {
  <ui-medium-title>{{ title }}</ui-medium-title>
  <ui-excerpt [excerpt]="excerpt" />
}
```

## Architecture

This library is part of the UI layer architecture:
- **`@ui/layout`** - Structural containers (cards, sections, grids)
- **`@ui/content`** - Content presentation (titles, excerpts, text formatting)
- **Other UI libs** - Feature-specific components

## Future Extensions

Potential additions:
- Paragraph components with various styles
- Blockquote components
- Caption components
- Code block styling
- List formatting components

