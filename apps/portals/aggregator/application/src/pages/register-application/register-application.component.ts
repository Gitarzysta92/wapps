import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { TuiAppearance, TuiButton, TuiTextfield } from '@taiga-ui/core';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  buildRoutePath,
  IBreadcrumbRouteData,
  NavigationDeclarationDto,
  routingDataConsumerFrom,
} from '@portals/shared/boundary/navigation';
import { NAVIGATION } from '../../navigation';
import {
  isDraftSlug,
  isDraftUrl,
  LocalApplicationDraftsService,
} from '../my-apps/local-application-drafts.service';

@Component({
  selector: 'register-application-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiAppearance,
    TuiButton,
    TuiTextfield,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
  ],
  templateUrl: './register-application.component.html',
  styleUrl: './register-application.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterApplicationPageComponent
  implements routingDataConsumerFrom<IBreadcrumbRouteData>
{
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly draftId = input<string>();
  readonly store = inject(LocalApplicationDraftsService);
  private readonly router = inject(Router);
  readonly saved = signal(false);
  private readonly editingId = signal<string | undefined>(undefined);
  readonly missing = signal(false);
  readonly title = computed(() =>
    this.draftId() ? 'Edit application draft' : 'Register application'
  );
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(100),
        (c) => (c.value.trim().length >= 2 ? null : { name: true }),
      ],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        (c) => (isDraftSlug(c.value.trim()) ? null : { slug: true }),
      ],
    }),
    website: new FormControl('', {
      nonNullable: true,
      validators: [(c) => (isDraftUrl(c.value.trim()) ? null : { url: true })],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(2000),
        (c) => (c.value.trim().length >= 20 ? null : { description: true }),
      ],
    }),
  });
  constructor() {
    effect(() => {
      const id = this.draftId();
      untracked(() => {
        this.store.refresh();
        const draft = this.store.data().applications.find((d) => d.id === id);
        this.editingId.set(id);
        this.missing.set(!!id && !draft);
        this.saved.set(false);
        this.form.reset(
          draft ?? { name: '', slug: '', website: '', description: '' }
        );
      });
    });
  }
  save(): void {
    this.saved.set(false);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.missing()) return;
    const draft = this.store.saveApplication(
      this.form.getRawValue(),
      this.editingId()
    );
    if (draft) {
      this.editingId.set(draft.id);
      this.form.markAsPristine();
      this.saved.set(true);
    }
  }
  navigateToMyApps(): void {
    void this.router.navigate([
      buildRoutePath(NAVIGATION.myApplications.path, {}),
    ]);
  }
}
