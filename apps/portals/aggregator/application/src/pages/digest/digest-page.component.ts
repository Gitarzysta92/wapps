import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiIcon, TuiLink } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { NAVIGATION } from '../../navigation';
import { buildDigestContent } from './digest-content';

@Component({
  selector: 'digest-page',
  standalone: true,
  imports: [RouterLink, TuiAppearance, TuiIcon, TuiLink, TuiAvatar, BreadcrumbsComponent,
    PageHeaderComponent, PageTitleComponent, PreferredDatePipe],
  templateUrl: './digest-page.component.html',
  styleUrl: './digest-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DigestPageComponent {
  readonly content = buildDigestContent();
  readonly breadcrumbs = [NAVIGATION.home, NAVIGATION.digest];
  readonly failedImages = signal(new Set<string>());

  imageFailed(slug: string): void {
    this.failedImages.update(previous => new Set([...previous, slug]));
  }
}
