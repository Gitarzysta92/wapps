import { Directive, EventEmitter, inject, Output } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { combineLatest, map } from 'rxjs';

@Directive({
  selector: '[routeDrivenContainer]',
  exportAs: 'routeDrivenContainer'
})
export class RouteDrivenContainerDirective {


  private readonly _route = inject(ActivatedRoute);

  public params$ = combineLatest([
    this._route.queryParamMap,
    this._route.paramMap,
  ]).pipe(
    map(([q, p]) => this._combineParamMaps(q, p)),
  )
  

  private _combineParamMaps(p: ParamMap, q: ParamMap): { [key: string]: Set<string> } {
    const map: { [key: string]: Set<string> } = {};
    for (let pmap of [p, q]) {
      for (let key of pmap.keys) {
        key in map ?
          pmap.getAll(key).forEach(k => map[key].add(k)) :
          map[key] = new Set(pmap.getAll(key));
      }
    }
    return map;
  }
}
