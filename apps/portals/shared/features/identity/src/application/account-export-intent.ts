import { Injectable } from '@angular/core';

/** Retain uncertain requests across route changes; a full reload recovers the canonical latest job. */
@Injectable({ providedIn: 'root' })
export class AccountExportIntent {
  private session: string | null = null;
  key: string | null = null;
  bind(session: string | null): void {
    if (session !== this.session) this.key = null;
    this.session = session;
  }
}
