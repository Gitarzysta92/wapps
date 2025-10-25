import { Component, inject, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService } from '@ui/navigation';
import { GlobalStateService } from '../../state/global-state.service';
import { SmartSearchInputContainerComponent } from '@portals/shared/features/smart-search';
import { StickyElementDirective, OutOfViewportChange } from '@ui/misc';
import { TuiIcon } from '@taiga-ui/core';


@Component({
  selector: 'header',
  templateUrl: "header.component.html",
  styleUrl: 'header.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    SmartSearchInputContainerComponent,
    StickyElementDirective,
  ]
})
export class HeaderPartialComponent {
  public readonly state = inject(GlobalStateService);
  public readonly navigation = inject(NavigationService).config;
  
  public isChatBannerCollapsed = true;

  @Input() showCollapseButton = false;

  @Output() expandedStateChange = new EventEmitter<boolean>();
  
  public toggleChatBanner(): void {
    this.isChatBannerCollapsed = !this.isChatBannerCollapsed;
    if (this.isChatBannerCollapsed) {
      this.showCollapseButton = true;
    }
    this.expandedStateChange.emit(!this.isChatBannerCollapsed);
  }

  public onOutOfViewportChange(event: OutOfViewportChange): void {
    this.showCollapseButton = event.isOutOfViewport;
  }
}