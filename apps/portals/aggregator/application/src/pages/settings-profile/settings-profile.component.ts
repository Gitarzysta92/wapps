import { RouterLink } from '@angular/router';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiAvatar, TuiSkeleton, TuiTextarea } from '@taiga-ui/kit';
import { TuiCardLarge, TuiForm } from '@taiga-ui/layout';
import { NavigationDeclarationDto, IBreadcrumbRouteData, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { MY_PROFILE_VIEW_STATE_PROVIDER, MyProfileService } from '@portals/shared/features/my-profile';
import { PageHeaderComponent, PageTitleComponent, ContentStateComponent } from '@ui/layout';
import { SettingsNavigationComponent } from '../settings/settings-navigation.component';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';

@Component({
  selector: 'settings-profile-page',
  templateUrl: 'settings-profile.component.html',
  styleUrl: 'settings-profile.component.scss',
  standalone: true,
  imports: [
    RouterLink,
    ContentStateComponent,
    SettingsNavigationComponent,
    FormsModule,
    TuiAppearance,
    TuiAvatar,
    TuiButton,
    TuiCardLarge,
    TuiSkeleton,
    TuiForm,
    TuiTextfield,
    TuiTextarea,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
  ]
})
export class SettingsProfilePageComponent implements routingDataConsumerFrom<IBreadcrumbRouteData> {
  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);

  private readonly myProfileStateProvider = inject(MY_PROFILE_VIEW_STATE_PROVIDER);

  // Profile state
  public readonly profile = computed(() => this.myProfileStateProvider.state().data);
  public readonly isLoading = this.myProfileStateProvider.isLoading;
  public readonly isError = this.myProfileStateProvider.isError;

  // Form state
  protected readonly formData = signal({
    name: '',
    bio: '',
    location: '',
    website: '',
    twitter: '',
    linkedin: '',
    github: ''
  });

  public reload(): void { this.profileService.reload(); }

  private readonly profileService = inject(MyProfileService);
  protected readonly avatarUri = signal('');
  protected readonly isSaving = signal(false);
  protected readonly isReadingAvatar = signal(false);
  protected readonly feedback = signal('');
  protected readonly saveError = signal(false);
  private avatarReadVersion = 0;

  constructor() {
    effect(() => {
      const profile = this.profile();
      if (profile) this.restoreForm(profile);
    });
  }

  private restoreForm(profile: NonNullable<ReturnType<typeof this.profile>>): void {
    this.avatarReadVersion++;
    this.isReadingAvatar.set(false);
    this.formData.set({
      name: profile.name, bio: profile.bio ?? '', location: profile.location ?? '',
      website: profile.socialLinks?.website ?? '', twitter: profile.socialLinks?.twitter ?? '',
      linkedin: profile.socialLinks?.linkedin ?? '', github: profile.socialLinks?.github ?? ''
    });
    this.avatarUri.set(profile.avatar?.uri ?? '');
  }

  protected onFieldChange(key: keyof ReturnType<typeof this.formData>, value: string): void {
    this.formData.update(form => ({ ...form, [key]: value }));
    this.feedback.set('');
  }

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const version = ++this.avatarReadVersion;
    this.isReadingAvatar.set(false);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      this.saveError.set(true);
      this.feedback.set('Choose a JPEG, PNG or WebP image up to 1 MB.');
      return;
    }
    this.isReadingAvatar.set(true);
    const reader = new FileReader();
    const fail = () => {
      if (version !== this.avatarReadVersion) return;
      this.isReadingAvatar.set(false);
      this.saveError.set(true);
      this.feedback.set('Could not read this image. Choose another file.');
    };
    reader.onerror = fail;
    reader.onload = () => {
      const image = new Image();
      image.onerror = fail;
      image.onload = () => {
        if (version !== this.avatarReadVersion) return;
        this.avatarUri.set(reader.result as string);
        this.isReadingAvatar.set(false);
        this.saveError.set(false);
        this.feedback.set('Photo ready. Save Changes to keep it.');
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  protected onRemoveAvatar(): void {
    this.avatarReadVersion++;
    this.isReadingAvatar.set(false);
    this.avatarUri.set('');
    this.saveError.set(false);
    this.feedback.set('Photo removed from the form. Save Changes to keep this change.');
  }

  protected async onSave(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.isSaving() || this.isReadingAvatar() || this.isLoading()) return;
    const form = this.formData();
    this.saveError.set(false);
    if (!form.name.trim() || form.name.trim().length > 100 || form.bio.length > 500) {
      this.saveError.set(true);
      this.feedback.set('Enter a display name of 1–100 characters and a bio of at most 500 characters.');
      return;
    }
    for (const value of [form.website, form.linkedin]) {
      if (!value.trim()) continue;
      try {
        if (!['https:', 'http:'].includes(new URL(value.trim()).protocol)) throw new Error();
      } catch {
        this.saveError.set(true);
        this.feedback.set('Website and LinkedIn links must be valid http or https URLs.');
        return;
      }
    }
    this.isSaving.set(true);
    this.feedback.set('');
    try {
      const result = await firstValueFrom(this.profileService.updateProfile({
        ...profile,
        name: form.name.trim(), bio: form.bio.trim(), location: form.location.trim(),
        avatar: this.avatarUri() ? { uri: this.avatarUri(), alt: form.name.trim() } : undefined,
        socialLinks: { ...profile.socialLinks, website: form.website.trim(), twitter: form.twitter.trim(),
          linkedin: form.linkedin.trim(), github: form.github.trim() }
      }));
      if (!result.ok || !result.value) throw new Error('Save failed');
      this.feedback.set('Profile saved on this browser.');
    } catch {
      this.saveError.set(true);
      this.feedback.set('Could not save. Browser storage may be unavailable or full. Your changes are still in the form.');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected onCancel(): void {
    const profile = this.profile();
    if (profile) this.restoreForm(profile);
    this.saveError.set(false);
    this.feedback.set('Restored saved profile.');
  }
}
