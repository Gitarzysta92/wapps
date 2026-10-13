import { ApplicationConfig } from '@angular/core';
import {
  CATALOG_BROWSER,
  CATALOG_API_URL,
  DEMO_CATALOG_ENTRIES,
} from './application/catalog-browser.port';
import { CatalogBrowserService } from './application/catalog-browser.service';
import { CATALOG_ENTRIES } from './application/catalog-listing';
import { CatalogBrowseApiService } from './infrastructure/catalog-browse-api.service';
import { CatalogBrowseDemoService } from './infrastructure/catalog-browse-demo.service';

export function provideListingFeature(config: {
  mode: 'api' | 'demo';
  apiUrl?: string;
}): ApplicationConfig {
  return {
    providers: [
      {
        provide: CATALOG_API_URL,
        useValue: (config.apiUrl ?? '').replace(/\/$/, ''),
      },
      ...(config.mode === 'demo'
        ? [{ provide: DEMO_CATALOG_ENTRIES, useValue: () => CATALOG_ENTRIES }]
        : []),
      {
        provide: CATALOG_BROWSER,
        useClass:
          config.mode === 'api'
            ? CatalogBrowseApiService
            : CatalogBrowseDemoService,
      },
      CatalogBrowserService,
    ],
  };
}
