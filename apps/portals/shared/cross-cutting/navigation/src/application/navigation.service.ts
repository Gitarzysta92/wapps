import { inject, Injectable } from "@angular/core";
import { NAVIGATION_CONFIGURATION } from "../navigation-configuration.token";
import { INavigationDeclaration } from "../navigation.interface";

@Injectable()
export class NavigationService {

  public get config() { return this._cfg }

  private readonly _cfg = inject(NAVIGATION_CONFIGURATION);
  private readonly _declarations = Object.values(inject(NAVIGATION_CONFIGURATION))


  public getNavigationFor(id: string): INavigationDeclaration[] {
    return this._declarations
      .filter(d => d.slots.some(s => s.id === id))
      .sort((a, b) => {
        const sa = a.slots.find(s => s.id === id)!;
        const sb = b.slots.find(s => s.id === id)!;
        return sa.order + sb.order
      })
  }

  public getNavigationMapFor<T extends string>(id: string): Record<T, INavigationDeclaration> {
    return Object.fromEntries(Object.entries(this._cfg)
      .filter(e => e[1].slots.some(s => s.id === id))) as Record<T, INavigationDeclaration>
  }
}