// Example of how to use the injection token in a module or component

import { NgModule } from '@angular/core';
import { FEED_PROVIDER } from './feed-provider.provider';

// In your module's providers array:
@NgModule({
  // ... other module configuration
  providers: [
    FEED_PROVIDER, // This provides the IFeedProviderPort interface
    // ... other providers
  ]
})
export class FeedModule {}

// Or in a component's providers array:
@Component({
  // ... component configuration
  providers: [
    FEED_PROVIDER, // This provides the IFeedProviderPort interface
    // ... other providers
  ]
})
export class SomeComponent {}

// Or in your main.ts or app.config.ts for global registration:
// providers: [FEED_PROVIDER]
