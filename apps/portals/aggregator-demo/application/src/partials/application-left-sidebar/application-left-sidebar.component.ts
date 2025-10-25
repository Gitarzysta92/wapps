import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppDto } from '../../../../../../../libs/domains/catalog/record/src';
import { TuiAvatar } from '@taiga-ui/kit';
import { NavigationDeclaration } from '@ui/navigation';
import { RoutePathPipe } from '@ui/routing';


@Component({
  selector: 'application-left-sidebar',
  templateUrl: './application-left-sidebar.component.html',
  styleUrl: './application-left-sidebar.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    RoutePathPipe
  ]
})
export class ApplicationLeftSidebarPartialComponent {

  @Input() appSlug: string | undefined;
  @Input() isExpanded = false;
  @Input() navigation: NavigationDeclaration[] = [];
  @Output() toggleExpansion = new EventEmitter<void>();

  public getRouterLinkActiveOptions(path: string): { exact: boolean } {
    // Use exact matching for home route (empty path) to avoid matching all routes
    return { exact: path === '' };
  }

  public buildMockFromSlug(slug: string): AppDto {
    const name = (slug ?? '')
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return {
      id: slug,
      slug,
      name,
      logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      isPwa: true,
      rating: 4.7,
      tagIds: [],
      categoryId: 0,
      platformIds: [],
      reviewNumber: 1234,
      updateDate: new Date(),
      listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    };
  }
}

