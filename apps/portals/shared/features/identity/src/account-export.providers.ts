import type { Provider } from '@angular/core';
import {
  ACCOUNT_EXPORT,
  ACCOUNT_EXPORT_URL,
} from './application/account-export.port';
import { AccountExportApiService } from './infrastructure/account-export-api.service';

export function provideAccountExport(apiUrl: string): Provider[] {
  if (apiUrl) {
    const url = new URL(apiUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid account export API origin');
  }
  return [
    { provide: ACCOUNT_EXPORT_URL, useValue: apiUrl.replace(/\/$/, '') },
    { provide: ACCOUNT_EXPORT, useClass: AccountExportApiService },
  ];
}
