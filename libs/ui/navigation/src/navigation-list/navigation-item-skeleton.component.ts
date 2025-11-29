import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton } from '@taiga-ui/kit';

@Component({
  selector: 'a[navigationItemSkeleton], button[navigationItemSkeleton]',
  template: `
    @if (showLabel()) {
      <span [tuiSkeleton]="3"></span>
    }
    @if (showIcon()) {
      <tui-icon  [tuiSkeleton]="true"/>
    }
  `,
  styleUrl: './navigation-item-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TuiSkeleton, TuiIcon],
  host: {
    '[class.active]': 'active()',
  }
})
export class NavigationItemSkeletonComponent {
  label = input<boolean>(true);
  icon = input<boolean>(true);
  active = input<boolean>(false);

  protected showLabel = computed(() => this.label());
  protected showIcon = computed(() => this.icon());
}

