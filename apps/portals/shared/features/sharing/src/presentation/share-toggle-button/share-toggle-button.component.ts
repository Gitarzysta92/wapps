import { ChangeDetectionStrategy, Component, DestroyRef, inject, Input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiActiveZone } from '@taiga-ui/cdk';
import { TuiAppearance, TuiButton, TuiDropdown, TuiIcon } from '@taiga-ui/core';
import { SharingService } from '../../application/sharing.service';

@Component({
  selector: 'share-toggle-button',
  templateUrl: './share-toggle-button.component.html',
  styleUrls: ['./share-toggle-button.component.scss'],
  imports: [TuiAppearance, TuiButton, TuiDropdown, TuiIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareToggleButtonComponent {
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm';
  @Input() appearance = 'action-soft';
  @Input() iconOnly = false;
  @Input() activeZone: TuiActiveZone | null = null;
  @Input({ required: true }) type!: 'applications' | 'suites' | 'articles' | 'discussions';
  @Input({ required: true }) slug!: string;
  @Input({ required: true }) title!: string;
  /** Exact portal route for nested resources such as application discussions. */
  @Input() path?: string;
  private readonly service = inject(SharingService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isSharing = signal(false);
  readonly message = signal('');
  readonly fallbackUrl = signal('');
  readonly linkUrl = signal('');
  readonly deviceShareAvailable = signal(false);
  open = false;

  setOpen(open: boolean): void {
    if (this.open === open) return;
    this.open = open;
    if (!open || this.isSharing()) return;
    this.message.set('');
    this.fallbackUrl.set('');
    this.linkUrl.set('');
    if (!this.type || !this.slug || !this.title) {
      this.message.set('A share link is not available for this item.');
      return;
    }
    try {
      this.linkUrl.set(this.service.contentUrl(this.type, this.slug, this.path));
      this.deviceShareAvailable.set(this.service.canShareViaDevice());
    } catch {
      this.message.set('A valid share link is not available for this item.');
    }
  }

  share(): void {
    if (this.deviceShareAvailable()) this.runAction('device');
  }

  copy(): void {
    this.runAction('copy');
  }

  private runAction(action: 'copy' | 'device'): void {
    if (this.isSharing() || !this.linkUrl()) return;
    this.message.set('');
    this.fallbackUrl.set('');
    this.isSharing.set(true);
    const operation = action === 'copy'
      ? this.service.copyContent(this.type, this.slug, this.path)
      : this.service.shareContent(this.type, this.slug, this.title, this.path);
    const failed = () => {
      this.fallbackUrl.set(this.linkUrl());
      this.message.set(action === 'copy'
        ? 'Could not copy automatically. Select and copy the link below.'
        : 'Could not share through your device. You can copy the link below.');
    };
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.isSharing.set(false);
        if (result.ok) this.message.set(result.value
          ? (action === 'copy' ? 'Link copied.' : 'Shared through your device.')
          : 'Sharing cancelled.');
        else failed();
      },
      error: () => {
        this.isSharing.set(false);
        failed();
      },
      complete: () => this.isSharing.set(false),
    });
  }
}
