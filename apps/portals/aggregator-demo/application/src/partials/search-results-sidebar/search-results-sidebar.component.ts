import { Component, ChangeDetectionStrategy, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiAppearance, TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { DiscoverySearchResultType, DiscoverySearchResultGroupDto } from '@domains/discovery';
import { GlobalStateService } from '../../state/global-state.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { NAVIGATION } from '../../navigation';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { delay } from 'rxjs';
import { 
  NavigationListComponent, 
  NavigationItemSkeletonComponent,
  NavigationItemComponent,
} from '@ui/navigation';

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
    TuiIconPipe,
    RouterLink,
    NavigationListComponent,
    NavigationItemSkeletonComponent,
    NavigationItemComponent,
    TuiAppearance,
  ]
})
export class SearchResultsSidebarComponent {
  @Input() isExpanded = false;
  
  private readonly globalState = inject(GlobalStateService);
  
  protected readonly activeSection = toSignal(this.globalState.activeSection$, { initialValue: null });
  protected readonly resultsData = toSignal(this.globalState.searchResultsData$, { 
    initialValue: { itemsNumber: 0, groups: [], query: {}, isLoading: true }
  });

  HOME = NAVIGATION.home;

  // Map of type to icon
  private readonly iconMap: Record<DiscoverySearchResultType, string> = {
    [DiscoverySearchResultType.Suite]: '@tui.briefcase-business',
    [DiscoverySearchResultType.Application]: '@tui.layout-grid',
    [DiscoverySearchResultType.Article]: '@tui.newspaper'
  };

  // Map of type to label
  private readonly labelMap: Record<DiscoverySearchResultType, string> = {
    [DiscoverySearchResultType.Suite]: 'Suites',
    [DiscoverySearchResultType.Application]: 'Applications',
    [DiscoverySearchResultType.Article]: 'Articles'
  };

  // Dynamically computed navigation items from the results data
  protected readonly navigationItems = computed(() => {
    const data = this.resultsData();
    if (!data || data.isLoading) {
      return [];
    }
    
    return data.groups.map((group: DiscoverySearchResultGroupDto) => ({
      label: this.labelMap[group.type] || group.type,
      icon: this.iconMap[group.type] || 'tuiIconFile',
      type: group.type,
      sectionId: group.type,
      count: group.entries.length
    }));
  });

  protected readonly isLoading = computed(() => this.resultsData()?.isLoading ?? true);

  public scrollToSection(type: DiscoverySearchResultType): void {
    const navItem = this.navigationItems().find(item => item.type === type);
    if (navItem) {
      const element = document.getElementById(navItem.sectionId);
      if (element) {
        const yOffset = -80; // Offset for sticky header
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  }

  public isActive(type: DiscoverySearchResultType): boolean {
    return this.activeSection() === type;
  }
}

