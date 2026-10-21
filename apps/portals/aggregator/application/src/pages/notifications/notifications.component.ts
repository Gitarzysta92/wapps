import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import {
  ContentStateComponent,
  MediumCardComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import type { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import {
  provideReplyInbox,
  provideMentionInbox,
  MentionInboxService,
  provideFavoriteUpdates,
  FavoriteUpdatesService,
  ReplyInboxService,
} from '@portals/shared/features/identity';
import { API_BASE_URL, CATALOG_MODE } from '../../environment';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    ContentStateComponent,
    MediumCardComponent,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
  ],
  providers: [
    provideReplyInbox(CATALOG_MODE, API_BASE_URL),
    provideMentionInbox(CATALOG_MODE, API_BASE_URL),
    provideFavoriteUpdates(CATALOG_MODE, API_BASE_URL),
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly inbox = inject(ReplyInboxService);
  readonly mentions = inject(MentionInboxService);
  readonly favorites = inject(FavoriteUpdatesService);
  readonly category = signal<'replies' | 'favorites' | 'mentions'>('replies');
  readonly activeInbox = computed(() =>
    this.category() === 'replies'
      ? this.inbox
      : this.category() === 'favorites'
      ? this.favorites
      : this.mentions
  );
  readonly isDemo = CATALOG_MODE === 'demo';
}
