import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, IsActiveMatchOptions } from '@angular/router';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';

@Component({
  selector: 'common-mobile-bottom-bar',
  standalone: true,
  templateUrl: './common-mobile-bottom-bar.component.html',
  styleUrl: './common-mobile-bottom-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    TuiButton,
    TuiIcon,
    TuiIconPipe
  ]
})
export class CommonMobileBottomBarPartialComponent {

  @Input() navigation: NavigationDeclarationDto[] = [];

  public trackByNavigationPath(_: number, item: NavigationDeclarationDto): string {
    return item.path;
  }

  public getRouterLinkActiveOptions(path: string): IsActiveMatchOptions {
    return {
      paths: path === '' ? 'exact' : 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored'
    };
  }
}



