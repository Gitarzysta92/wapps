import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiIcon, TuiLink, TuiButton } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  PageHeaderComponent,
  PageTitleComponent,
  ContentStateComponent,
} from '@ui/layout';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import {
  ArticleCoverImageComponent,
  provideArticleCovers,
} from '@portals/shared/features/articles';
import { DigestService } from '@portals/shared/features/feed';
import { NAVIGATION } from '../../navigation';
import { exploreLink } from '../../explore-links';

@Component({
  selector: 'digest-api-page',
  imports: [
    RouterLink,
    TuiAppearance,
    TuiIcon,
    TuiLink,
    TuiButton,
    TuiAvatar,
    BreadcrumbsComponent,
    PageHeaderComponent,
    PageTitleComponent,
    ContentStateComponent,
    PreferredDatePipe,
    ArticleCoverImageComponent,
  ],
  providers: [DigestService, provideArticleCovers()],
  templateUrl: './digest-api-page.component.html',
  styleUrls: [
    './digest-page.component.scss',
    './digest-api-page.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DigestApiPageComponent {
  readonly digest = inject(DigestService);
  readonly breadcrumbs = [NAVIGATION.home, NAVIGATION.digest];
  readonly link = exploreLink;
  readonly labels = {
    application: 'Application update',
    suite: 'Suite publication',
    article: 'Article publication',
    release: 'Release',
    discussion: 'Discussion',
    review: 'Member review',
  };
  timestamp(at: number) {
    return new Date(at).toISOString();
  }
}
