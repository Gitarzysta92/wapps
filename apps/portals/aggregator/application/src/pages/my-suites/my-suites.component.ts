import { ContentStateComponent, PageHeaderComponent, PageTitleComponent, MediumCardComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import { EntryDetailsDataService } from '../entry-details-page/entry-details-data.service';

@Component({
  selector: 'my-suites-page',
  templateUrl: './my-suites.component.html',
  styleUrl: './my-suites.component.scss',
  standalone: true,
  imports: [TuiAppearance, PageHeaderComponent, PageTitleComponent, MediumCardComponent, BreadcrumbsComponent, ContentStateComponent, RouterLink, TuiButton, TuiLink, TuiAvatar, TuiBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySuitesPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly suites = inject(EntryDetailsDataService).listMySuites();
}
