import { Component, inject } from '@angular/core';
import { CategoriesService, CategoryDtoToCategoryViewModelMapper, CategoryVm } from '@portals/shared/features/categories';
import { AsyncPipe } from '@angular/common';
import { BehaviorSubject, map, switchMap } from 'rxjs';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'applications-panel',
  templateUrl: './applications-panel.component.html',
  styleUrl: './applications-panel.component.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
  ]
})
export class ApplicationsPanelComponent {
  private readonly _mapper = inject(CategoryDtoToCategoryViewModelMapper);
  private readonly _service = inject(CategoriesService);
  private readonly _router = inject(Router);
  private readonly _selectedCategoryId$ = new BehaviorSubject<number>(1);
    
  public readonly categories$ = this._service
    .getCategories()
    .pipe(map(cs => cs.map(c => this._mapper.map(c))));
  
  public readonly childCategories$ = this._selectedCategoryId$
    .pipe(
      switchMap(id => this._service.getCategoryChildren(id)),
      map(cs => cs.map(c => this._mapper.map(c)))
    );
  
  public readonly selectedCategory$ = this._selectedCategoryId$
    .pipe(
      switchMap(id => this._service.getCategory(id)),
      map(c => this._mapper.map(c))
    )
    
  public selectCategory(c: CategoryVm): void {
    this._selectedCategoryId$.next(c.id);
  }
}
