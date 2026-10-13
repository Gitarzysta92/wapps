import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TuiButton } from '@taiga-ui/core';
import { ARTICLE_SESSION } from '../application/article-workspace.port';
import {
  ARTICLE_COVERS,
  type ArticleCoverPreview,
} from '../application/article-cover.port';

@Component({
  selector: 'article-cover-image',
  standalone: true,
  imports: [TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './article-cover.scss',
  template: `
    @if (!session() && target().kind !== 'published') {
    <p>Sign in to view this cover.</p>
    } @if (loading()) {
    <p role="status">Loading article cover...</p>
    } @if (url()) { <img [src]="url()" [alt]="alt()" (error)="failed()" /> } @if
    (error()) {
    <p role="alert">{{ error() }}</p>
    <button
      tuiButton
      size="s"
      appearance="secondary"
      type="button"
      (click)="retry.update(increment)"
    >
      Retry article cover
    </button>
    }
  `,
})
export class ArticleCoverImageComponent {
  readonly target = input.required<ArticleCoverPreview>();
  readonly alt = input.required<string>();
  readonly url = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly retry = signal(0);
  readonly increment = (value: number) => value + 1;
  private readonly port = inject(ARTICLE_COVERS);
  readonly session = toSignal(inject(ARTICLE_SESSION).key$, {
    initialValue: null,
  });
  private release?: () => void;
  constructor() {
    effect((cleanup) => {
      const target = this.target(),
        session = this.session();
      this.retry();
      this.url.set('');
      this.error.set('');
      this.loading.set(false);
      if (!session && target.kind !== 'published') return;
      this.loading.set(true);
      let url: string | null = null;
      const release = () => {
        if (url) URL.revokeObjectURL(url);
        url = null;
      };
      this.release = release;
      const subscription = this.port.preview(target).subscribe({
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
          this.error.set('Article cover unavailable. Try again.');
        },
      });
      cleanup(() => {
        subscription.unsubscribe();
        release();
      });
    });
  }
  failed() {
    this.release?.();
    this.url.set('');
    this.error.set('This cover could not be displayed. Reload its preview.');
  }
}
