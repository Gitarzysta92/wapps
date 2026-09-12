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
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
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
  selector: 'ownership-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiButton,
    TuiTextfield,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
  ],
  templateUrl: './ownership.component.html',
  styleUrl: './ownership.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnershipPageComponent
  implements routingDataConsumerFrom<IBreadcrumbRouteData>
{
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly appSlug = input('');
  readonly store = inject(LocalApplicationDraftsService);
  private readonly router = inject(Router);
  readonly validSlug = computed(() => isDraftSlug(this.appSlug()));
  readonly saved = signal(false);
  readonly form = new FormGroup({
    evidenceUrl: new FormControl('', {
      nonNullable: true,
      validators: [(c) => (isDraftUrl(c.value.trim()) ? null : { url: true })],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(2000),
        (c) => (c.value.trim().length >= 20 ? null : { notes: true }),
      ],
    }),
  });
  constructor() {
    effect(() => {
      const slug = this.appSlug();
      untracked(() => {
        this.store.refresh();
        const draft = this.store
          .data()
          .ownership.find((d) => d.appSlug === slug);
        this.form.reset(draft ?? { evidenceUrl: '', notes: '' });
        this.saved.set(false);
      });
    });
  }
  save(): void {
    this.saved.set(false);
    this.form.markAllAsTouched();
    if (!this.validSlug() || this.form.invalid) return;
    const value = this.form.getRawValue();
    if (
      this.store.saveOwnership(this.appSlug(), value.evidenceUrl, value.notes)
    ) {
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
