import { computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  defaultAccountPreferences,
  mergePreferences,
  type PreferencesPatch,
} from '@domains/customer/preferences';
import { PreferencesService } from './preferences.service';
import {
  PreferencesSaveError,
  type PreferencesEditContext,
} from './preferences-session.port';
import type { PreferencesState } from './preferences.state';

/** One editor per page; drafts retain the account/revision that supplied them. */
export class PreferencesEditor {
  readonly service = inject(PreferencesService);
  readonly data = signal(defaultAccountPreferences());
  readonly isSaving = signal(false);
  readonly feedback = signal('');
  readonly saveError = signal(false);
  readonly conflict = signal(false);
  readonly isGuest = computed(() => this.service.scope() === 'guest');
  readonly isDemo = this.service.mode === 'demo';
  private context: PreferencesEditContext | null = null;
  private sessionVersion = -1;
  private dirty = false;
  private editVersion = 0;

  constructor() {
    effect(() => {
      const state = this.service.state();
      untracked(() => this.accept(state));
    });
  }

  private accept(state: PreferencesState): void {
    if (this.sessionVersion !== state.sessionVersion) {
      this.sessionVersion = state.sessionVersion;
      this.context = null;
      this.dirty = false;
      this.data.set(defaultAccountPreferences());
      this.feedback.set('');
      this.saveError.set(false);
      this.conflict.set(false);
    }
    if (state.context && (!this.dirty || !this.context)) {
      this.context = state.context;
      this.data.set(structuredClone(state.data));
    }
  }

  patch(change: PreferencesPatch): void {
    this.editVersion++;
    this.data.set(mergePreferences(this.data(), change));
    this.dirty = true;
    this.feedback.set('');
  }

  reload(): void {
    this.dirty = false;
    this.context = null;
    this.feedback.set('');
    this.saveError.set(false);
    this.conflict.set(false);
    this.service.reload();
  }

  cancel(): void {
    this.dirty = false;
    this.context = this.service.state().context;
    this.data.set(structuredClone(this.service.getPreferences()));
    this.saveError.set(false);
    this.conflict.set(false);
    this.feedback.set('Restored loaded settings.');
  }

  async save(change: PreferencesPatch): Promise<void> {
    if (this.isSaving() || this.service.isLoading() || this.isGuest()) return;
    const context = this.context;
    const editVersion = this.editVersion;
    this.isSaving.set(true);
    this.feedback.set('');
    this.saveError.set(false);
    try {
      const result = await firstValueFrom(
        this.service.updatePreferences(change, context)
      );
      if (context?.sessionVersion !== this.service.state().sessionVersion)
        return;
      if (!result.ok) throw result.error;
      if (!result.value) throw new Error('The save was not confirmed.');
      if (this.dirty && editVersion !== this.editVersion) {
        this.conflict.set(true);
        this.feedback.set(
          'Submitted settings saved. Newer edits remain in this form. Reload the saved settings before saving again.'
        );
        return;
      }
      this.dirty = false;
      this.conflict.set(false);
      // Demo reads can complete synchronously before the save promise resolves.
      this.accept(this.service.state());
      this.feedback.set(
        this.isDemo
          ? 'Saved on this browser.'
          : 'Preferences saved to your account.'
      );
    } catch (error) {
      if (context?.sessionVersion !== this.service.state().sessionVersion)
        return;
      this.saveError.set(true);
      this.conflict.set(
        error instanceof PreferencesSaveError && error.reason === 'conflict'
      );
      this.feedback.set(
        error instanceof Error
          ? error.message
          : 'Could not confirm the save. Your edits are still in this form.'
      );
    } finally {
      this.isSaving.set(false);
    }
  }
}
