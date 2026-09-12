import { ChangeDetectionStrategy, Component, inject, Injector, Input, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, IsActiveMatchOptions } from '@angular/router';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiSheetDialogService } from '@taiga-ui/addon-mobile';
import { UserPanelSheetComponent } from '../user-panel-sheet/user-panel-sheet.component';


// TODO: inputs should be typed
// based on component input declarations
// it also should respect polymorpheus component data type
export interface CommonMobileBottomBarPanel<T = unknown> {
  component: Type<T>;
  inputs: Record<symbol, unknown>;
}

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
    TuiIcon
  ]
})
export class CommonMobileBottomBarPartialComponent {

  @Input() navigationPrimary: NavigationDeclarationDto[] = [];
  @Input() navigationSecondary: NavigationDeclarationDto[] = [];
  @Input() navigationActive: NavigationDeclarationDto | null = null;
  @Input() sheetDialog: CommonMobileBottomBarPanel | null = null;

  private readonly _dialogService = inject(TuiSheetDialogService);
  private readonly _injector = inject(Injector);
  private readonly router = inject(Router);

  public isActive(item: NavigationDeclarationDto): boolean {
    return this.navigationActive
      ? this.navigationActive.path === item.path
      : this.router.isActive(item.path.startsWith('/') ? item.path : '/' + item.path, this.getRouterLinkActiveOptions(item.path));
  }

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

  public openDialog(): void {
    this._dialogService.open(
      new PolymorpheusComponent(this.sheetDialog?.component ?? UserPanelSheetComponent, this._injector),
      {
        data: this.sheetDialog?.inputs ?? {},
        closeable: true,
        fullscreen: false }
    ).subscribe();
  }
}
