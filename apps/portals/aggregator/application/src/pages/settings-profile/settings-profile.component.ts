import { RouterLink } from '@angular/router';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiAvatar, TuiSkeleton, TuiTextarea } from '@taiga-ui/kit';
import { TuiCardLarge, TuiForm } from '@taiga-ui/layout';
import {
  NavigationDeclarationDto,
  IBreadcrumbRouteData,
  routingDataConsumerFrom,
} from '@portals/shared/boundary/navigation';
import {
  MY_PROFILE_VIEW_STATE_PROVIDER,
  MyProfileService,
  ProfileAvatarEditorComponent,
} from '@portals/shared/features/my-profile';
import {
  PageHeaderComponent,
  PageTitleComponent,
  ContentStateComponent,
} from '@ui/layout';
import { SettingsNavigationComponent } from '../settings/settings-navigation.component';
import {
  BreadcrumbsComponent,
  BreadcrumbsSkeletonComponent,
} from '@ui/breadcrumbs';
import { parseProfileUpdate } from '@domains/customer/profiles';
import { ProfileSaveError } from '@portals/shared/features/my-profile';
import { EmailVerificationStatusComponent } from '@portals/shared/features/identity';

@Component({
  selector: 'settings-profile-page',
  templateUrl: 'settings-profile.component.html',
  styleUrl: 'settings-profile.component.scss',
  standalone: true,
  imports: [
    RouterLink,
    EmailVerificationStatusComponent,
    ProfileAvatarEditorComponent,
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
  ],
})
export class SettingsProfilePageComponent
  implements routingDataConsumerFrom<IBreadcrumbRouteData>
{
  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);

  private readonly myProfileStateProvider = inject(
    MY_PROFILE_VIEW_STATE_PROVIDER
  );

  // Profile state
  public readonly profile = computed(
    () => this.myProfileStateProvider.state().data
  );
  public readonly isLoading = this.myProfileStateProvider.isLoading;
  public readonly isError = this.myProfileStateProvider.isError;

  // Form state
  protected readonly formData = signal({
    name: '',
    bio: '',
    location: '',
    contactEmail: '',
    website: '',
    twitter: '',
    linkedin: '',
    github: '',
  });

  public reload(): void {
    this.conflict.set(false);
    this.feedback.set('');
    this.profileService.reload();
  }

  private readonly profileService = inject(MyProfileService);
  protected readonly isDemo = this.profileService.mode === 'demo';
  protected readonly conflict = signal(false);
  protected readonly avatarUri = signal('');
  protected readonly isSaving = signal(false);
  protected readonly photoSaving = signal(false);
  protected readonly photoEnabled = computed(() => {
    const profile = this.profile();
    const form = this.formData();
    return (
      !!profile?.joinedAt &&
      !this.isSaving() &&
      form.name === profile.name &&
      form.bio === (profile.bio ?? '') &&
      form.location === (profile.location ?? '') &&
      form.contactEmail === (profile.contactEmail ?? '') &&
      ['website', 'twitter', 'linkedin', 'github'].every(
        (key) =>
          form[key as 'website' | 'twitter' | 'linkedin' | 'github'] ===
          (profile.socialLinks?.[
            key as 'website' | 'twitter' | 'linkedin' | 'github'
          ] ?? '')
      )
    );
  });
  protected readonly isReadingAvatar = signal(false);
  protected readonly feedback = signal('');
  protected readonly saveError = signal(false);
  private avatarReadVersion = 0;

  constructor() {
    effect(() => {
      const profile = this.profile();
      if (profile) this.restoreForm(profile);
      else {
        this.avatarReadVersion++;
        this.isReadingAvatar.set(false);
        this.formData.set({
          name: '',
          bio: '',
          location: '',
          contactEmail: '',
          website: '',
          twitter: '',
          linkedin: '',
          github: '',
        });
        this.avatarUri.set('');
      }
    });
  }

  private restoreForm(
    profile: NonNullable<ReturnType<typeof this.profile>>
  ): void {
    this.avatarReadVersion++;
    this.isReadingAvatar.set(false);
    this.formData.set({
      name: profile.name,
      bio: profile.bio ?? '',
      location: profile.location ?? '',
      contactEmail: profile.contactEmail ?? '',
      website: profile.socialLinks?.website ?? '',
      twitter: profile.socialLinks?.twitter ?? '',
      linkedin: profile.socialLinks?.linkedin ?? '',
      github: profile.socialLinks?.github ?? '',
    });
    this.avatarUri.set(profile.avatar?.uri ?? '');
  }

  protected onFieldChange(
    key: keyof ReturnType<typeof this.formData>,
    value: string
  ): void {
    this.formData.update((form) => ({ ...form, [key]: value }));
    this.feedback.set('');
  }

  protected onAvatarSelected(event: Event): void {
    if (!this.isDemo) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const version = ++this.avatarReadVersion;
    this.isReadingAvatar.set(false);
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
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
    if (!this.isDemo) return;
    this.avatarReadVersion++;
    this.isReadingAvatar.set(false);
    this.avatarUri.set('');
    this.saveError.set(false);
    this.feedback.set(
      'Photo removed from the form. Save Changes to keep this change.'
    );
  }

  protected async onSave(): Promise<void> {
    const profile = this.profile();
    if (
      !profile ||
      this.isSaving() ||
      this.photoSaving() ||
      this.isReadingAvatar() ||
      this.isLoading()
    )
      return;
    const form = this.formData();
    this.saveError.set(false);
    try {
      parseProfileUpdate({
        expectedRevision: profile.revision ?? 1,
        name: form.name.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
        contactEmail: form.contactEmail,
        socialLinks: {
          ...profile.socialLinks,
          website: form.website.trim(),
          twitter: form.twitter.trim(),
          linkedin: form.linkedin.trim(),
          github: form.github.trim(),
        },
      });
    } catch (error) {
      this.saveError.set(true);
      this.feedback.set(
        error instanceof Error ? error.message : 'Check your profile fields.'
      );
      return;
    }
    this.isSaving.set(true);
    this.feedback.set('');
    try {
      const result = await firstValueFrom(
        this.profileService.updateProfile({
          ...profile,
          name: form.name.trim(),
          bio: form.bio.trim(),
          location: form.location.trim(),
          contactEmail: form.contactEmail,
          avatar: this.avatarUri()
            ? { uri: this.avatarUri(), alt: form.name.trim() }
            : undefined,
          socialLinks: {
            ...profile.socialLinks,
            website: form.website.trim(),
            twitter: form.twitter.trim(),
            linkedin: form.linkedin.trim(),
            github: form.github.trim(),
          },
        })
      );
      if (!result.ok) throw result.error;
      if (!result.value) throw new Error('Save could not be confirmed.');
      this.conflict.set(false);
      this.feedback.set(
        this.isDemo
          ? 'Profile saved on this browser.'
          : 'Profile saved to your account.'
      );
    } catch (error) {
      this.saveError.set(true);
      this.conflict.set(
        error instanceof ProfileSaveError && error.reason === 'conflict'
      );
      this.feedback.set(
        error instanceof Error
          ? error.message
          : 'Could not confirm the save. Your changes are still in the form.'
      );
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
