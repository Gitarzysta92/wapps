import { Component, Input } from '@angular/core';
import type { CoverImageDto } from './cover-image.dto';

@Component({
  selector: 'ui-cover-image',
  templateUrl: './cover-image.component.html',
  styleUrl: './cover-image.component.scss',
  standalone: true,
})
export class CoverImageComponent {
  @Input() image?: CoverImageDto;

  get imageUrl(): string | undefined {
    return this.image?.url;
  }

  get alt(): string {
    return this.image?.alt || 'Cover image';
  }

  hasImage(): boolean {
    return !!this.imageUrl;
  }
}
