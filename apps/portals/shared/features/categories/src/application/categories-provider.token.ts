import { InjectionToken } from "@angular/core";
import { ICategoriesProvider } from "@domains/catalog/category";

export const CATEGORIES_PROVIDER = new InjectionToken<ICategoriesProvider>('CategoriesProvider');