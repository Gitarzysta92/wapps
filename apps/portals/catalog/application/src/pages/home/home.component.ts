import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiIcon, TuiLoader } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { CatalogApiService } from '../../services/catalog-api.service';
import { AppRecordDto } from '../../services/catalog.dto';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'home-page',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiIcon,
    TuiBadge,
    TuiLoader,
  ]
})
export class HomePageComponent implements OnInit {
  private readonly catalogApi = inject(CatalogApiService);

  public readonly apps = signal<AppRecordDto[]>([]);
  public readonly isLoading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly navigation = NAVIGATION;

  ngOnInit(): void {
    this.loadApps();
  }

  private loadApps(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.catalogApi.getApps().subscribe({
      next: (response) => {
        this.apps.set(response.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load applications. Please try again later.');
        this.isLoading.set(false);
        console.error('Error loading apps:', err);
      }
    });
  }

  public getAppLink(slug: string): string {
    return `/apps/${slug}`;
  }

  public formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
