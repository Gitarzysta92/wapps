import { Component, OnInit, inject, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiIcon, TuiButton, TuiLoader } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { CatalogApiService } from '../../services/catalog-api.service';
import { AppRecordDto } from '../../services/catalog.dto';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'app-details-page',
  templateUrl: './app-details.component.html',
  styleUrl: './app-details.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiIcon,
    TuiButton,
    TuiBadge,
    TuiLoader,
  ]
})
export class AppDetailsPageComponent implements OnInit {
  private readonly catalogApi = inject(CatalogApiService);

  // Router input binding
  public readonly appSlug = input<string>('');

  public readonly app = signal<AppRecordDto | null>(null);
  public readonly isLoading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly navigation = NAVIGATION;

  ngOnInit(): void {
    this.loadApp();
  }

  private loadApp(): void {
    const slug = this.appSlug();
    if (!slug) {
      this.error.set('App slug is missing');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.catalogApi.getAppBySlug(slug).subscribe({
      next: (app) => {
        if (app) {
          this.app.set(app);
        } else {
          this.error.set('Application not found');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load application details. Please try again later.');
        this.isLoading.set(false);
        console.error('Error loading app:', err);
      }
    });
  }

  public formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
