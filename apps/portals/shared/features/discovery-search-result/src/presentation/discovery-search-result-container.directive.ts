import { Directive, inject } from "@angular/core";
import { DiscoverySearchResultService } from "../application/discovery-search-result.service";


@Directive({
  selector: '[discoverySearchResultContainer]',
  exportAs: 'discoverySearchResultContainer'
})
export class DiscoverySearchResultContainerDirective {
  public readonly searchResults$ = inject(DiscoverySearchResultService).searchResults$;
}

