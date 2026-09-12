import { ChangeDetectionStrategy, Component, DestroyRef, inject, Input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { SharingService } from '../../application/sharing.service';

@Component({
  selector: 'share-toggle-button',
  templateUrl: './share-toggle-button.component.html',
  styleUrls: ['./share-toggle-button.component.scss'],
  imports: [TuiButton, TuiIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareToggleButtonComponent {
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm';
  @Input() appearance = 'action-soft';
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

  share(): void {
    if (this.isSharing()) return;
    this.message.set('');
    this.fallbackUrl.set('');
    if (!this.type || !this.slug || !this.title) {
      this.message.set('A share link is not available for this item.');
      return;
    }
    let url: string;
    try { url = this.service.contentUrl(this.type, this.slug, this.path); }
    catch { this.message.set('A valid share link is not available for this item.'); return; }
    if (!this.service.canShare()) {
      this.fallbackUrl.set(url);
      this.message.set('Select and copy this link to share it.');
      return;
    }
    this.isSharing.set(true);
    this.service.shareContent(this.type, this.slug, this.title, this.path).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.isSharing.set(false);
        if (result.ok) this.message.set(result.value ? 'Link shared through your device or copied to the clipboard.' : 'Sharing cancelled.');
        else { this.fallbackUrl.set(url); this.message.set('Could not share automatically. Select and copy the link.'); }
      },
      error: () => {
        this.isSharing.set(false);
        this.fallbackUrl.set(url);
        this.message.set('Could not share automatically. Select and copy the link.');
      },
      complete: () => this.isSharing.set(false),
    });
  }
}
