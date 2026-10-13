import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
  MediumCardComponent,
} from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import type { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import {
  MyDiscussionsService,
  provideMyDiscussions,
  QuickDiscussionButtonComponent,
} from '@portals/shared/features/discussion';
import { API_BASE_URL } from '../../environment';

@Component({
  selector: 'app-my-discussions-api-page',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
    MediumCardComponent,
    BreadcrumbsComponent,
    QuickDiscussionButtonComponent,
  ],
  providers: [provideMyDiscussions(API_BASE_URL)],
  templateUrl: './my-discussions-api-page.component.html',
  styleUrl: './my-discussions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyDiscussionsApiPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly discussions = inject(MyDiscussionsService);
}
