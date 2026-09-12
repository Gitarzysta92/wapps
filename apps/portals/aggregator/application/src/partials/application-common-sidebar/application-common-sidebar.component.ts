import { Component, ChangeDetectionStrategy, input, inject, computed } from '@angular/core';
import { CommonSidebarComponent } from '../common-sidebar/common-sidebar.component';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { APPLICATION_OVERVIEW_PROVIDER } from '@portals/shared/features/application-overview';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map, catchError, of } from 'rxjs';

@Component({
  selector: 'application-common-sidebar',
  template: `
    <common-sidebar
      [avatarPath]="avatarPath()"
      [isExpanded]="isExpanded()"
      [navigation]="navigation()"
      [navigationSecondary]="navigationSecondary()"
      [navigationAvatar]="navigationAvatar()"
      [alignment]="alignment()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonSidebarComponent]
})
export class ApplicationCommonSidebarComponent {
  public readonly appSlug = input.required<string>();
  public readonly navigationAvatar = input<NavigationDeclarationDto | null>(null);
  public readonly isExpanded = input<boolean>(false);
  public readonly navigation = input<NavigationDeclarationDto[]>([]);
  public readonly navigationSecondary = input<NavigationDeclarationDto[]>([]);
  public readonly alignment = input<'start' | 'end'>('end');

  private readonly overviewProvider = inject(APPLICATION_OVERVIEW_PROVIDER);

  private readonly overview$ = toObservable(this.appSlug).pipe(
    switchMap(slug => this.overviewProvider.getOverview(slug).pipe(
      map(result => result.ok ? result.value : null),
      catchError(() => of(null))
    ))
  );

  private readonly overview = toSignal(this.overview$, { initialValue: null });

  protected readonly avatarPath = computed(() => this.overview()?.logo ?? null);
}

