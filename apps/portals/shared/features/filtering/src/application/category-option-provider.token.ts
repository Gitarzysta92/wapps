import { InjectionToken } from "@angular/core";
import { ICategoryOptionProvider } from "@domains/catalog/category";

export const CATEGORY_OPTION_PROVIDER = new InjectionToken<ICategoryOptionProvider>('CategoryOptionProvider');