import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiTitle, TuiAppearance } from '@taiga-ui/core';
import { TuiCardLarge, TuiHeader } from '@taiga-ui/layout';
import { LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { APPLICATIONS } from '@portals/shared/data';

@Component({
  selector: 'my-discussions-page',
  templateUrl: 'my-discussions.component.html',
  styleUrl: 'my-discussions.component.scss',
  standalone: true,
  imports: [TuiTitle, TuiAppearance, TuiCardLarge, TuiHeader, RouterLink]
})
export class MyDiscussionsPageComponent {
  private readonly localData = inject(LocalDiscussionsService);
  readonly discussions = computed(() => APPLICATIONS.flatMap(app => this.localData.threads(app.slug)
    .filter(d => d.author.id === 'local-reader' || d.replies.some(r => r.author.id === 'local-reader'))
    .map(d => ({ ...d, appSlug: app.slug, appName: app.name })))
    .sort((a, b) => b.publishedTime.getTime() - a.publishedTime.getTime()));
}
