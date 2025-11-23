import { ChangeDetectionStrategy, Component, inject, Injector, Input, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, IsActiveMatchOptions } from '@angular/router';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiSheetDialogService } from '@taiga-ui/addon-mobile';


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
  @Input() sheetDialog: CommonMobileBottomBarPanel | null = null;

  private readonly _dialogService = inject(TuiSheetDialogService);
  private readonly _injector = inject(Injector);
  
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
    if (!this.sheetDialog) {
      return;
    }
    this._dialogService.open(
      new PolymorpheusComponent(this.sheetDialog.component, this._injector),
      {
        data: this.sheetDialog.inputs,
        closeable: true,
        fullscreen: false }
    ).subscribe();
  }
}



