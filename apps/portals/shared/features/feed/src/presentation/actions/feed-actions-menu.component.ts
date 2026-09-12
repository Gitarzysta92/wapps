import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ContextMenuItem } from '@ui/context-menu-chip';

@Component({
  selector: 'feed-actions-menu',
  standalone: true,
  imports: [TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (contextMenu?.length) {
      <details #menu>
        <summary [attr.aria-label]="'More actions for ' + title">More actions</summary>
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
  @Input() size = 'xs';
  @Input() appearance = 'action-soft-flat';
  readonly error = signal('');
  run(action: ContextMenuItem, menu: HTMLDetailsElement): void {
    this.error.set('');
    try { action.action(); menu.open = false; }
    catch { this.error.set('This action could not be completed.'); }
  }
}
