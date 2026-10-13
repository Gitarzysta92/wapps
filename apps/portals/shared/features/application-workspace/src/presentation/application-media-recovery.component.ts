import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ApplicationMediaService } from '../application/application-media.service';

@Component({
  selector: 'application-media-recovery',
  standalone: true,
  imports: [TuiButton],
  templateUrl: './application-media-recovery.component.html',
  styleUrl: './application-media.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationMediaRecoveryComponent {
  readonly draftId = input<string | null>(null);
  readonly disabled = input(false);
  readonly media = inject(ApplicationMediaService);
  resume(event: Event) {
    const element = event.target;
    if (!(element instanceof HTMLInputElement)) return;
    const file = element.files?.item(0);
    element.value = '';
    if (file && !this.disabled()) this.media.retry(file);
  }
}
