# Content Library Migration

## Overview
Created a new `@ui/content` library to centralize content-styling components, separating them from structural layout components.

## Architectural Decision

### Before
- Title components were part of `@ui/layout`
- Excerpt had its own dedicated library `@ui/excerpt`
- Mixed responsibility: layout contained both structure AND content styling

### After
- `@ui/layout` - Pure structural containers (cards, sections, grids)
- `@ui/content` - Content presentation (titles, excerpts, text formatting)
- Clear separation of concerns

## Changes Made

### 1. Created New Library
- **Path**: `libs/ui/content`
- **Import alias**: `@ui/content`
- **Type**: Buildable Angular library with ng-packagr

### 2. Migrated Components

#### From `@ui/excerpt`:
- ✅ `ExcerptComponent`
- ✅ `ExcerptSkeletonComponent`

#### From `@ui/layout`:
- ✅ `MediumTitleSkeletonComponent`

#### New Components:
- ✅ `MediumTitleDirective` - Directive for styling titles with `[uiMediumTitle]`

### 3. Updated Imports
- Search results page now imports from `@ui/content`
- Removed `@ui/excerpt` from tsconfig paths
- Removed `MediumTitleSkeletonComponent` export from `@ui/layout`

### 4. Deleted
- ❌ `libs/ui/excerpt` - Entire library removed
- ❌ `libs/ui/layout/src/card/medium-card/medium-title-skeleton.*` - Moved to content

## Usage Examples

### Title Directive
```typescript
import { MediumTitleDirective } from '@ui/content';
```

```html
<h3 uiMediumTitle slot="title">{{ article.title }}</h3>
```

### Excerpt Component
```typescript
import { ExcerptComponent } from '@ui/content';
```

```html
<ui-excerpt [excerpt]="text" [maxLength]="200" />
```

### Skeletons
```typescript
import { 
  MediumTitleSkeletonComponent,
  ExcerptSkeletonComponent 
} from '@ui/content';
```

```html
<ui-medium-title-skeleton />
<ui-excerpt-skeleton />
```

## Future Extensions

The content library is designed to accommodate:
- Paragraph components
- Blockquote styling
- Caption components
- Code block presentation
- List formatting
- Typography utilities

## Breaking Changes

⚠️ **Import paths changed**:
- `@ui/excerpt` → `@ui/content`
- `MediumTitleSkeletonComponent` from `@ui/layout` → `@ui/content`

## Migration Guide for Other Projects

If other projects use the old imports:

1. Replace `@ui/excerpt` with `@ui/content`
2. Update `MediumTitleSkeletonComponent` imports from `@ui/layout` to `@ui/content`
3. No API changes - components work exactly the same

## Build Status
✅ Library builds successfully with `nx build ui-content`

