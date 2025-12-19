# Sharing Feature

A reusable sharing feature for portals that provides a share toggle button component similar to the favorite toggle functionality.

## Features

- **Web Share API Support**: Uses native share functionality when available
- **Clipboard Fallback**: Automatically falls back to copying URL to clipboard
- **Type-Safe**: Supports applications, suites, articles, and discussions
- **Responsive UI**: Modern share button with loading and success states

## Usage

### 1. Provide the Feature

```typescript
import { provideSharingFeature } from '@portals/shared/features/sharing';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSharingFeature({
      baseUrl: 'https://your-domain.com'
    })
  ]
};
```

### 2. Use the Share Toggle Button Component

```html
<share-toggle-button
  type="applications"
  slug="my-app-slug"
  title="My Awesome App">
</share-toggle-button>
```

## Component Inputs

- `type` (required): Type of content - 'applications' | 'suites' | 'articles' | 'discussions'
- `slug` (required): Unique identifier for the content
- `title` (required): Title to be shared

## Architecture

Follows the standard feature architecture:

- **Application Layer**: Business logic and service interfaces
- **Infrastructure Layer**: Web Share API and clipboard integration
- **Presentation Layer**: Share toggle button component

## Browser Support

- Modern browsers with Web Share API support
- Falls back to clipboard copy for unsupported browsers
- Requires HTTPS for Web Share API to work




