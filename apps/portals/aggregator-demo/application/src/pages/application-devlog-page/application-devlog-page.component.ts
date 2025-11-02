import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AsyncPipe, NgFor } from '@angular/common';
import { map, shareReplay } from 'rxjs';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';
import { AppRecordDto } from '@domains/catalog/record';

@Component({
  selector: 'app-application-devlog-page',
  standalone: true,
  imports: [
    AsyncPipe,
    NgFor,
    TuiButton,
    TuiIcon,
    TuiChip
  ],
  templateUrl: './application-devlog-page.component.html',
  styleUrl: './application-devlog-page.component.scss'
})
export class ApplicationDevlogPageComponent {
  private readonly _route = inject(ActivatedRoute);

  public readonly app$ = this._route.paramMap.pipe(
    map(p => p.get('appSlug') ?? 'unknown'),
    map(slug => this._buildMockFromSlug(slug)),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  getVersion(): string {
    return '2.1.0';
  }

  getDescription(): string {
    return 'Major update with new features and improvements';
  }

  getReleaseDate(): string {
    return new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  getChanges(): string[] {
    return [
      'New user interface improvements',
      'Performance optimizations',
      'Bug fixes and stability improvements',
      'Added dark mode support',
      'Enhanced security features'
    ];
  }

  getChangeType(): 'major' | 'minor' | 'patch' {
    return 'major';
  }

  getChangeTypeLabel(): string {
    const type = this.getChangeType();
    return type === 'major' ? 'Major Update' : type === 'minor' ? 'Minor Update' : 'Patch';
  }

  private _buildMockFromSlug(slug: string): AppRecordDto {
    const name = slug
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return {
      id: slug,
      slug,
      name,
      description: `${name} description`,
      logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      isPwa: true,
      rating: 4.7,
      tagIds: [],
      categoryId: 0,
      platformIds: [],
      reviewNumber: 1234,
      updateDate: new Date(),
      listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    };
  }
}
