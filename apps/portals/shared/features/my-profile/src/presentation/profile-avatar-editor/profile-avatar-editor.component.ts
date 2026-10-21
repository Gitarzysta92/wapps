import { Component, effect, inject, input, output } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ProfileAvatarEditorService } from '../../application/profile-avatar-editor.service';
import { provideProfileAvatarEditor } from '../../profile-avatar.providers';

@Component({
  selector: 'profile-avatar-editor',
  standalone: true,
  imports: [TuiButton],
  providers: provideProfileAvatarEditor(),
  templateUrl: './profile-avatar-editor.component.html',
  styleUrl: './profile-avatar-editor.component.scss',
})
export class ProfileAvatarEditorComponent {
  readonly hasPhoto = input(false);
  readonly enabled = input(false);
  readonly saving = output<boolean>();
  protected readonly editor = inject(ProfileAvatarEditorService);
  constructor() {
    effect(() => this.saving.emit(this.editor.busy()));
  }
  protected select(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.editor.select(file);
  }
}
