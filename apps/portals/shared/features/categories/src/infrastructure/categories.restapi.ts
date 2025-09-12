import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { Result } from "@standard";
import { CategoryDto, ICategoriesProvider } from "@domains/catalog/category";

@Injectable()
export class CategoriesRestApi implements ICategoriesProvider {

  private readonly _http = inject(HttpClient);

  public getCategories(): Observable<Result<CategoryDto[], Error>> {
    return this._http.get<CategoryDto[]>(`https://api.example.com/categories`).pipe(
      map(r => ({ ok: true, value: r }))
    );
  }
}

@Injectable()
export class CategoryApiService implements ICategoriesProvider {
  getCategories(): Observable<Result<CategoryDto[], Error>> {
    return of({
      ok: true,
      value: [
        {
          "id": 1,
          "name": "Work & Productivity",
          "childs": [
            {
              "id": 2,
              "name": "AI Notetakers",
              "childs": [],
              "slug": "ai-notetakers"
            },
            {
              "id": 3,
              "name": "Ad blockers",
              "childs": [],
              "slug": "ad-blockers"
            },
            {
              "id": 4,
              "name": "App switcher",
              "childs": [],
              "slug": "app-switcher"
            },
            {
              "id": 5,
              "name": "Calendar apps",
              "childs": [],
              "slug": "calendar-apps"
            },
            {
              "id": 6,
              "name": "Customer support tools",
              "childs": [],
              "slug": "customer-support-tools"
            },
            {
              "id": 7,
              "name": "E-signature apps",
              "childs": [],
              "slug": "e-signature-apps"
            },
            {
              "id": 8,
              "name": "Email clients",
              "childs": [],
              "slug": "email-clients"
            },
            {
              "id": 9,
              "name": "File storage and sharing apps",
              "childs": [],
              "slug": "file-storage-and-sharing-apps"
            },
            {
              "id": 10,
              "name": "Project management tools",
              "childs": [],
              "slug": "project-management-tools"
            }
          ],
          "slug": "work-productivity"
        }
      ]
    });
  }
}