import { Injectable } from '@angular/core';
import { defer, of } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  defaultAccountPreferences,
  mergePreferences,
  type PreferencesPatch,
} from '@domains/customer/preferences';
import type {
  PreferencesPort,
  PreferencesRead,
} from '../application/preferences-session.port';

export const GUEST_DISPLAY_STORAGE_KEY = 'wapps.guest-display.v1';

/** Anonymous display settings have their own storage and never seed account data. */
@Injectable()
export class GuestPreferencesService implements PreferencesPort {
  private readLocal(): PreferencesRead {
    const raw = localStorage.getItem(GUEST_DISPLAY_STORAGE_KEY);
    const data =
      raw === null
        ? defaultAccountPreferences()
        : mergePreferences(defaultAccountPreferences(), {
            display: JSON.parse(raw),
          });
    return { data, account: null };
  }
  read() {
    return defer(() => {
      try {
        return of(ok(this.readLocal()));
      } catch {
        return of(
          err(
            new Error(
              'Could not read guest display settings from this browser.'
            )
          )
        );
      }
    });
  }
  save(_snapshot: PreferencesRead, patch: PreferencesPatch) {
    return defer(() => {
      try {
        if (Object.keys(patch).some((key) => key !== 'display'))
          throw new Error('Sign in to save account settings.');
        const next = mergePreferences(this.readLocal().data, patch);
        localStorage.setItem(
          GUEST_DISPLAY_STORAGE_KEY,
          JSON.stringify(next.display)
        );
        return of(ok(true));
      } catch {
        return of(
          err(
            new Error('Could not save guest display settings on this browser.')
          )
        );
      }
    });
  }
}
