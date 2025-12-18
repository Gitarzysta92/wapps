import { Component, inject, Input, HostListener, HostBinding } from "@angular/core";
import { TuiButton, TuiIcon } from "@taiga-ui/core";
import { SharingService } from "../../application/sharing.service";

@Component({
  selector: "share-toggle-button",
  templateUrl: 'share-toggle-button.component.html',
  styleUrls: ['share-toggle-button.component.scss'],
  imports: [
    TuiIcon
  ],
  hostDirectives: [
    {
      directive: TuiButton,
      inputs: ['size'] // at minimum, just expose size
    }
  ],
  host: {
    'type': 'button',
  }
})
export class ShareToggleButtonComponent {

  @HostBinding('disabled')
  get isDisabled(): boolean {
    return !this.canShare || this.isSharing;
  }

  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm';

  @HostBinding('attr.data-size')
  get dataSize(): string {
    return this.size;
  }

  @Input({ required: true }) type!: 'applications' | 'suites' | 'articles' | 'discussions';
  @Input({ required: true }) slug!: string;
  @Input({ required: true }) title!: string;

  private readonly _sharingService = inject(SharingService);

  public isSharing = false;
  public shareSuccess = false;

  @HostListener('click')
  public share(): void {
    if (!this.type || !this.slug || !this.title) {
      throw new Error('ShareToggleButtonComponent requires type, slug, and title inputs');
    }

    if (!this._sharingService.canShare()) {
      console.warn('Sharing is not supported in this environment');
      return;
    }

    this.isSharing = true;
    this._sharingService.shareContent(this.type, this.slug, this.title)
      .subscribe({
        next: (result) => {
          if (result.ok) {
            this.shareSuccess = true;
            setTimeout(() => {
              this.shareSuccess = false;
            }, 2000);
          }
          this.isSharing = false;
        },
        error: () => {
          this.isSharing = false;
        }
      });
  }

  public get canShare(): boolean {
    return this._sharingService.canShare();
  }
}



