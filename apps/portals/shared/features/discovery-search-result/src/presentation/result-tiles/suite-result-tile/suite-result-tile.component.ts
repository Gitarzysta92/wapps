import { ChangeDetectionStrategy, Component, Input, Output } from '@angular/core';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiHint } from '@taiga-ui/core';
import { NgForOf, NgIf } from '@angular/common';
import type { DiscoverySearchResultSuiteItemDto } from '@domains/discovery';

export const SUITE_RESULT_TILE_SELECTOR = 'suite-result-tile';

export type SuiteResultTileVM = Omit<DiscoverySearchResultSuiteItemDto, 'tags'> & {
  tags: Array<DiscoverySearchResultSuiteItemDto['tags'][0] & { link: string }>;
  suiteLink: string;
  commentsLink: string;
}

@Component({
  selector: SUITE_RESULT_TILE_SELECTOR,
  templateUrl: './suite-result-tile.component.html',
  styleUrl: './suite-result-tile.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiChip,
    TuiAvatar,
    TuiHint,
    NgForOf,
    NgIf,
  ]
})
export class SuiteResultTileComponent {
  @Input() item!: SuiteResultTileVM;

  @Output() 

  getName(): string {
    return this.item.name;
  }

  getSlug(): string {
    return this.item.slug;
  }

  getCoverImageUrl(): string {
    return this.item.coverImageUrl;
  }

  getNumberOfApps(): number {
    return this.item.numberOfApps;
  }

  getCommentsNumber(): number {
    return this.item.commentsNumber;
  }

  getAuthorName(): string {
    return this.item.authorName;
  }

  getAuthorAvatarUrl(): string {
    return this.item.authorAvatarUrl;
  }

  getTags(): string[] {
    return this.item.tags.map(tag => tag.name);
  }

  getSuiteLink(): string {
    return this.item.suiteLink;
  }

  getCommentsLink(): string {
    return this.item.commentsLink;
  }

  getApplications(): Array<{ name: string; slug: string; avatarUrl: string }> {
    return this.item.applications || [];
  }

  hasApplications(): boolean {
    return !!this.item.applications && this.item.applications.length > 0;
  }
}

