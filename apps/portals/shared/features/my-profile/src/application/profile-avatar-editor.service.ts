import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, Subscription } from 'rxjs';
import { PROFILE_AVATAR } from './profile-avatar.port';
import { PROFILE_SESSION } from './profile-session.port';
import { MyProfileService } from './my-profile.service';

@Injectable()
export class ProfileAvatarEditorService {
  private readonly port = inject(PROFILE_AVATAR);
  private readonly profiles = inject(MyProfileService);
  private readonly session = inject(PROFILE_SESSION);
  private pending: {
    file: Blob | null;
    identityId: string;
    revision: number;
  } | null = null;
  private operation: Subscription | null = null;
  readonly busy = signal(false);
  readonly selected = signal('');
  readonly message = signal('');
  readonly failed = signal(false);

  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reset());
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  select(file: File): void {
    if (this.busy()) return;
    const profile = this.profiles.getMyProfile();
    if (!profile?.revision || !profile.joinedAt) return;
    this.failed.set(false);
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size < 1 ||
      file.size > 2 * 1024 * 1024
    ) {
      this.pending = null;
      this.selected.set('');
      this.failed.set(true);
      this.message.set('Choose a PNG, JPEG or WebP image up to 2 MiB.');
      return;
    }
    this.pending = { file, identityId: profile.id, revision: profile.revision };
    this.selected.set(file.name);
    this.message.set('Photo selected. Save photo to apply it.');
  }

  remove(): void {
    if (this.busy()) return;
    const profile = this.profiles.getMyProfile();
    if (!profile?.revision) return;
    // Preserve the original revision when retrying an uncertain removal.
    if (!this.pending || this.pending.file !== null)
      this.pending = {
        file: null,
        identityId: profile.id,
        revision: profile.revision,
      };
    this.selected.set('Remove saved photo');
    this.save();
  }

  save(): void {
    const pending = this.pending;
    if (!pending || this.busy()) return;
    const profile = this.profiles.getMyProfile();
    if (profile?.id !== pending.identityId) return;
    this.busy.set(true);
    this.failed.set(false);
    this.message.set('Saving photo...');
    this.operation = this.port
      .change(pending.identityId, pending.revision, pending.file)
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.pending = null;
          this.selected.set('');
          this.message.set('Photo saved to your account.');
          this.profiles.reload();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.failed.set(true);
          this.message.set(
            error instanceof Error
              ? error.message
              : 'Photo change could not be confirmed.'
          );
        },
      });
  }

  reload(): void {
    this.reset();
    this.profiles.reload();
  }

  private reset(): void {
    this.operation?.unsubscribe();
    this.operation = null;
    this.port.clear();
    this.pending = null;
    this.busy.set(false);
    this.selected.set('');
    this.message.set('');
    this.failed.set(false);
  }
}
