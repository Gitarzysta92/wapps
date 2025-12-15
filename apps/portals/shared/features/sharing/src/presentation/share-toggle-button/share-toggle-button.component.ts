import { Component, inject, Input } from "@angular/core";
import { TuiButton } from "@taiga-ui/core";
import { SharingService } from "../../application/sharing.service";

@Component({
  selector: "share-toggle-button",
  templateUrl: 'share-toggle-button.component.html',
  styleUrls: ['share-toggle-button.component.scss'],
  imports: [
    TuiButton
  ]
})
export class ShareToggleButtonComponent {

  @Input({ required: true }) type!: 'applications' | 'suites' | 'articles' | 'discussions';
  @Input({ required: true }) slug!: string;
  @Input({ required: true }) title!: string;

  private readonly _sharingService = inject(SharingService);

  public isSharing = false;
  public shareSuccess = false;

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
