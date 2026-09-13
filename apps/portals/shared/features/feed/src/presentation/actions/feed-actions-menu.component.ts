import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import { ContextMenuItem } from '@ui/context-menu-chip';

@Component({
  selector: 'feed-actions-menu',
  standalone: true,
  imports: [TuiAppearance, TuiButton, TuiIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (contextMenu?.length) {
      <details #menu>
        <summary tuiAppearance="flat" [class.icon-only]="iconOnly"
          [attr.aria-label]="'More actions for ' + title" [attr.title]="iconOnly ? 'More actions for ' + title : null">
          <tui-icon icon="@tui.ellipsis" aria-hidden="true" />
          @if (!iconOnly) { <span>More actions</span> }
        </summary>
        <div class="menu">
          @for (action of contextMenu; track $index) {
            <button tuiButton type="button" size="s" appearance="flat" (click)="run(action, menu)">{{ action.label }}</button>
          }
        </div>
      </details>
    }
    @if (error()) { <span role="alert">{{ error() }}</span> }
  `,
  styleUrl: './feed-actions.scss',
})
export class FeedActionsMenuComponent {
  @Input() contextMenu: ContextMenuItem[] | undefined;
  @Input() title = 'this item';
  @Input() iconOnly = false;
  readonly error = signal('');
  run(action: ContextMenuItem, menu: HTMLDetailsElement): void {
    this.error.set('');
    try { action.action(); menu.open = false; }
    catch { this.error.set('This action could not be completed.'); }
  }
}
