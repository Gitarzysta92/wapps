import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiLink } from '@taiga-ui/core';
import type { ArticleFields } from '@domains/publication/article';
import type { ArticleCoverUpload } from '@domains/catalog/media';
import { ArticleCoverService } from '../application/article-cover.service';
import { ArticleCoverImageComponent } from './article-cover-image.component';

@Component({
  selector: 'article-cover-editor',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TuiButton,
    TuiLink,
    ArticleCoverImageComponent,
  ],
  templateUrl: './article-cover-editor.component.html',
  styleUrl: './article-cover.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleCoverEditorComponent {
  readonly articleId = input.required<string>();
  readonly workspacePath = input.required<string>();
  readonly cover = input<ArticleFields['cover']>();
  readonly disabled = input(false);
  readonly changed = output<ArticleFields['cover']>();
  readonly media = inject(ArticleCoverService);
  readonly previewing = signal<string | null>(null);
  readonly cancellation = signal<ArticleCoverUpload | null>(null);
  constructor() {
    effect(() => {
      const id = this.articleId();
      this.media.sessionVersion();
      untracked(() => {
        this.previewing.set(null);
        this.cancellation.set(null);
        this.media.open(id);
      });
    });
  }
  choose(event: Event) {
    const file = this.file(event);
    if (file && !this.disabled()) this.media.select(file);
  }
  resume(event: Event, upload?: ArticleCoverUpload) {
    const file = this.file(event);
    if (!file || this.disabled()) return;
    if (upload) this.media.resume(upload, file);
    else this.media.retry(file);
  }
  select(upload: ArticleCoverUpload) {
    if (
      this.disabled() ||
      this.media.blocked() ||
      upload.status !== 'ready' ||
      upload.articleId !== this.articleId()
    )
      return;
    this.changed.emit({
      imageId: upload.id,
      alt: this.cover()?.imageId === upload.id ? this.cover()?.alt ?? '' : '',
    });
  }
  describe(alt: string) {
    const cover = this.cover();
    if (cover && !this.disabled()) this.changed.emit({ ...cover, alt });
  }
  remove() {
    if (!this.disabled()) this.changed.emit(undefined);
  }
  confirmCancel() {
    const upload = this.cancellation();
    this.cancellation.set(null);
    if (upload && !this.disabled()) this.media.cancel(upload);
  }
  private file(event: Event) {
    const element = event.target;
    if (!(element instanceof HTMLInputElement)) return null;
    const file = element.files?.item(0) ?? null;
    element.value = '';
    return file;
  }
}
