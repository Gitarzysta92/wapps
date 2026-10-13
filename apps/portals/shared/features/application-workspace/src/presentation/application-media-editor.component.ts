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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import type {
  ApplicationDraft,
  ApplicationDraftReceipt,
} from '@domains/catalog/record';
import type {
  ApplicationImagePurpose,
  ApplicationImageUpload,
} from '@domains/catalog/media';
import { ApplicationMediaService } from '../application/application-media.service';
import { ApplicationImagePreviewComponent } from './application-image-preview.component';
import { ApplicationMediaRecoveryComponent } from './application-media-recovery.component';

@Component({
  selector: 'application-media-editor',
  standalone: true,
  imports: [
    DatePipe,
    TuiAppearance,
    TuiButton,
    ApplicationImagePreviewComponent,
    ApplicationMediaRecoveryComponent,
  ],
  templateUrl: './application-media-editor.component.html',
  styleUrl: './application-media.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationMediaEditorComponent {
  readonly draft = input.required<ApplicationDraft>();
  readonly disabled = input(false);
  readonly changed = output<ApplicationDraftReceipt>();
  readonly media = inject(ApplicationMediaService);
  readonly purposes = ['logo', 'banner'] as const;
  readonly previewing = signal<string | null>(null);
  constructor() {
    effect(() => {
      const id = this.draft().id;
      this.media.sessionVersion();
      untracked(() => {
        this.previewing.set(null);
        this.media.open(id);
      });
    });
    this.media.changed.pipe(takeUntilDestroyed()).subscribe((receipt) => {
      if (receipt.id === this.draft().id) this.changed.emit(receipt);
    });
  }
  choose(event: Event, purpose: ApplicationImagePurpose) {
    const file = this.file(event);
    if (file && !this.disabled()) this.media.select(file, purpose);
  }
  resume(event: Event, upload?: ApplicationImageUpload) {
    const file = this.file(event);
    if (!file || this.disabled()) return;
    if (upload) this.media.resume(upload, file);
    else this.media.retry(file);
  }
  private file(event: Event) {
    const element = event.target;
    if (!(element instanceof HTMLInputElement)) return null;
    const file = element.files?.item(0) ?? null;
    element.value = '';
    return file;
  }
}
