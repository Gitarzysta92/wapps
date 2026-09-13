# Sharing Feature

A reusable sharing feature for portals that provides a share toggle button component similar to the favorite toggle functionality.

## Features

- **Share Options**: The button opens a popover before starting any share operation
- **Copy Link**: Explicitly copies the portal link, even when native sharing is available
- **Web Share API Support**: Offers "Share via device" when supported
- **Manual Copy Fallback**: Keeps a selectable link and feedback inside the popover if automatic copying fails
- **Type-Safe**: Supports applications, suites, articles, and discussions
- **Responsive UI**: Icon or labeled trigger, with progress and feedback contained in the popover

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
- Copy link remains available in browsers without native sharing
- Requires HTTPS for Web Share API to work



