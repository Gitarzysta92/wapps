import { formatDate } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { PreferencesService } from '../application/preferences.service';

/** Impure so a saved format change also updates an already visible, unchanged date. */
@Pipe({ name: 'preferredDate', standalone: true, pure: false })
export class PreferredDatePipe implements PipeTransform {
  private readonly preferences = inject(PreferencesService, { optional: true });
  private readonly locale = inject(LOCALE_ID);

  transform(value: Date | string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    try { return formatDate(value, this.preferences?.dateFormat() ?? 'dd/MM/yyyy', this.locale); }
    catch { return ''; }
  }
}
