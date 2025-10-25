import { Provider } from '@angular/core';
import { FEED_PROVIDER_TOKEN } from '../ports/feed-provider.port';
import { FeedProviderService } from '../services/feed-provider.service';

export const FEED_PROVIDER: Provider = {
  provide: FEED_PROVIDER_TOKEN,
  useClass: FeedProviderService
};
