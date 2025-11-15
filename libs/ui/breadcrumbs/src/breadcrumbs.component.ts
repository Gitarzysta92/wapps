import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import type { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';

@Component({
  selector: 'ui-breadcrumbs',
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TuiIcon,
  ],
})
export class BreadcrumbsComponent {
  public readonly breadcrumbs = input<NavigationDeclarationDto[]>([]);
}

