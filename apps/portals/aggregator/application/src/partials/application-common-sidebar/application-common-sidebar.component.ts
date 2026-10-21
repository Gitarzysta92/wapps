import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
  computed,
} from '@angular/core';
import { CommonSidebarComponent } from '../common-sidebar/common-sidebar.component';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { ApplicationOverviewService } from '@portals/shared/features/application-overview';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, catchError, of, startWith, map } from 'rxjs';

@Component({
  selector: 'application-common-sidebar',
  template: `
    <common-sidebar
      [avatarPath]="avatarPath()"
      [isExpanded]="isExpanded()"
      [navigation]="navigation()"
      [navigationSecondary]="navigationSecondary()"
      [navigationAvatar]="navigationAvatar()"
      [alignment]="alignment()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonSidebarComponent],
})
export class ApplicationCommonSidebarComponent {
  public readonly appSlug = input.required<string>();
  public readonly navigationAvatar = input<NavigationDeclarationDto | null>(
    null
  );
  public readonly isExpanded = input<boolean>(false);
  public readonly navigation = input<NavigationDeclarationDto[]>([]);
  public readonly navigationSecondary = input<NavigationDeclarationDto[]>([]);
  public readonly alignment = input<'start' | 'end'>('end');

  private readonly overviewProvider = inject(ApplicationOverviewService);

  private readonly overview$ = toObservable(
    computed(() => ({
      slug: this.appSlug(),
      choice: this.overviewProvider.contentChoice(),
    }))
  ).pipe(
    switchMap(({ slug, choice }) =>
      this.overviewProvider.getOverview(slug).pipe(
        map((record) => ({ record, slug, choice })),
        catchError(() => of(null)),
        startWith(null)
      )
    )
  );

  private readonly overview = toSignal(this.overview$, { initialValue: null });

  protected readonly avatarPath = computed(() => {
    const result = this.overview();
    return result?.choice === this.overviewProvider.contentChoice() &&
      result?.slug === this.appSlug()
      ? result?.record.logo ?? '@tui.box'
      : '@tui.box';
  });
}
