import { Directive, EventEmitter, inject, Output } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { combineLatest, map } from 'rxjs';

@Directive({
  selector: '[routeDrivenContainer]',
  exportAs: 'routeDrivenContainer'
})
export class RouteDrivenContainerDirective {

  @Output() onUpdate: EventEmitter<{ [key: string]: Set<string> }> = new EventEmitter()

  private readonly _route = inject(ActivatedRoute);

  public params$ = combineLatest([
    this._route.queryParamMap,
    this._route.paramMap,
  ]).pipe(
    map(([q, p]) => this._combineParamMaps(q, p)),
  )
  
  public update(params: { [key: string]: Set<string> }): void {
    this.onUpdate.next(params);
  }

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
