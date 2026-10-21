import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TuiButton, TuiLink } from '@taiga-ui/core';
import type { ApplicationImageReference } from '@domains/catalog/media';
import { APPLICATION_WORKSPACE_SESSION } from '../application/application-drafts.port';
import {
  APPLICATION_MEDIA,
  type ApplicationMediaPreview,
} from '../application/application-media.port';

@Component({
  selector: 'application-image-preview',
  standalone: true,
  imports: [TuiButton, TuiLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!session()) {
    <p>Sign in to view this image.</p>
    } @else { @if (reference(); as image) { @if (image.kind === 'external') {
    <p>Existing external image</p>
    <a
      tuiLink
      [href]="image.url"
      target="_blank"
      rel="noopener noreferrer"
      referrerpolicy="no-referrer"
      >Open {{ label() }} (new tab)</a
    >
    } @else { @if (loading()) {
    <p role="status">Loading {{ label() }}...</p>
    } @if (url()) {
    <img [src]="url()" [alt]="label()" (error)="failedImage()" /> } @if
    (error()) {
    <p role="alert">{{ error() }}</p>
    <button
      tuiButton
      size="s"
      appearance="secondary"
      type="button"
      (click)="retry.update(increment)"
    >
      Retry {{ label() }}
    </button>
    } } } @else {
    <p>No {{ label() }}.</p>
    } }
  `,
  styleUrl: './application-media.scss',
})
export class ApplicationImagePreviewComponent {
  readonly reference = input<ApplicationImageReference | null>(null);
  readonly target = input<ApplicationMediaPreview | null>(null);
  readonly label = input('image');
  readonly url = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly retry = signal(0);
  readonly increment = (value: number) => value + 1;
  private release?: () => void;
  private readonly port = inject(APPLICATION_MEDIA);
  readonly session = toSignal(inject(APPLICATION_WORKSPACE_SESSION).key$, {
    initialValue: null,
  });
  constructor() {
    effect((cleanup) => {
      const reference = this.reference(),
        target = this.target(),
        session = this.session();
      this.retry();
      this.url.set('');
      this.error.set('');
      this.loading.set(false);
      if (!session || reference?.kind !== 'upload' || !target) return;
      this.loading.set(true);
      let url: string | null = null;
      const release = () => {
        if (url) URL.revokeObjectURL(url);
        url = null;
      };
      this.release = release;
      const subscription = this.port
        .preview(target, reference.asset)
        .subscribe({
          next: (result) => {
            this.loading.set(false);
            if (result.ok) {
              release();
              url = URL.createObjectURL(result.value);
              this.url.set(url);
            } else this.error.set(result.error.message);
          },
          error: () => {
            this.loading.set(false);
            this.error.set('Image preview unavailable. Try again.');
          },
        });
      cleanup(() => {
        subscription.unsubscribe();
        release();
      });
    });
  }
  failedImage() {
    this.release?.();
    this.url.set('');
    this.error.set('This image could not be displayed. Reload its preview.');
  }
}
