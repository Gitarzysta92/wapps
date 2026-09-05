import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiAvatar, TuiSwitch } from '@taiga-ui/kit';
import { TuiCardLarge, TuiForm, TuiHeader } from '@taiga-ui/layout';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { PageHeaderComponent, PageTitleComponent, CommonSectionComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';

@Component({
  selector: 'settings-profile-page',
  templateUrl: 'settings-profile.component.html',
  styleUrl: 'settings-profile.component.scss',
  standalone: true,
  imports: [
    FormsModule,
    TuiAppearance,
    TuiAvatar,
    TuiButton,
    TuiCardLarge,
    TuiForm,
    TuiHeader,
    TuiSwitch,
    TuiTextfield,
    PageHeaderComponent,
    PageTitleComponent,
    CommonSectionComponent,
    BreadcrumbsComponent,
  ]
})
export class SettingsProfilePageComponent {
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

  // Saving state
  protected readonly isSaving = signal(false);

  constructor() {
    // Initialize form data when profile loads
  }

  protected onSave(): void {
    this.isSaving.set(true);
    // TODO: Implement save logic
    setTimeout(() => {
      this.isSaving.set(false);
    }, 1000);
  }

  protected onCancel(): void {
    // Reset form to original values
  }
}

