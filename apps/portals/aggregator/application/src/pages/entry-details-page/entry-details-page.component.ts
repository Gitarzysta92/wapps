import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, shareReplay } from 'rxjs';
import { TuiButton, TuiLink } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import { AppPreviewDto } from '@domains/catalog/record';

@Component({
  selector: 'entry-details-page',
  standalone: true,
  imports: [
    // Angular
    AsyncPipe,
    DatePipe,
    // UI
    TuiButton,
    TuiLink,
    TuiAvatar,
    TuiBadge,
  ],
  templateUrl: './entry-details-page.component.html',
  styleUrl: './entry-details-page.component.scss'
})
export class EntryDetailsPageComponent {
  private readonly _route = inject(ActivatedRoute);

  // In lieu of a real API, derive a minimal record model from the slug param.
  // Do not extend the domain shape beyond what's provided by AppPreviewDto.
  public readonly app$ = this._route.paramMap.pipe(
    map(p => p.get('entrySlug') ?? 'unknown'),
    map(slug => this._buildMockFromSlug(slug)),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  private _buildMockFromSlug(slug: string): AppPreviewDto & { updateDate: Date } {
    const name = slug
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return {
      id: slug,
      slug,
      name,
      logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      isPwa: true,
      rating: 4.6,
      reviews: 1234,
      tagIds: [],
      categoryId: 0,
      platformIds: [],
      updateDate: new Date(),
    };
  }
}
