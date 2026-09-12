import { formatDate } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'feedDate', standalone: true })
export class FeedDatePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);
  transform(value: unknown): string {
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return 'Date unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : formatDate(date, 'medium', this.locale);
  }
}
