import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { DiscoverySearchResultType } from '@domains/discovery';
import { GlobalStateService } from '../../state/global-state.service';
import { toSignal } from '@angular/core/rxjs-interop';



@Component({
  selector: 'search-results-sidebar',
  templateUrl: './search-results-sidebar.component.html',
  styleUrl: './search-results-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    TuiIconPipe
  ]
})
export class SearchResultsSidebarComponent {
  @Input() isExpanded = false;
  
  private readonly globalState = inject(GlobalStateService);
  protected readonly activeSection = toSignal(this.globalState.activeSection$, { initialValue: null });

  public navigationItems = [
    {
      label: 'Suites',
      icon: 'tuiIconLayers',
      type: DiscoverySearchResultType.Suite
    },
    {
      label: 'Applications',
      icon: 'tuiIconGrid',
      type: DiscoverySearchResultType.Application
    },
    {
      label: 'Articles',
      icon: 'tuiIconFileText',
      type: DiscoverySearchResultType.Article
    }
  ];

  public scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -80; // Offset for sticky header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  public isActive(sectionId: string): boolean {
    const navItem = this.navigationItems.find(item => item.type === sectionId);
    return navItem ? this.activeSection() === navItem.type : false;
  }
}

