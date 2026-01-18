import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiDialogs, TuiDropdowns } from '@taiga-ui/core';
import { GlobalStateService } from './state/global-state.service';

@Component({
  selector: "body",
  template: `
    <router-outlet></router-outlet>
    <tui-dialogs />
    <tui-dropdowns />
  `,
  standalone: true,
  imports: [
    RouterOutlet,
    TuiDialogs,
    TuiDropdowns,
  ],
  providers: [
    GlobalStateService,
  ],
  encapsulation: ViewEncapsulation.None
})
export class AppRootComponent {}
