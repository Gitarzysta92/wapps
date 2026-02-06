import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiDialogs, TuiDropdowns } from '@taiga-ui/core';

@Component({
  selector: 'body',
  template: `
    <router-outlet></router-outlet>
    <tui-dialogs />
    <tui-dropdowns />
  `,
  standalone: true,
  imports: [RouterOutlet, TuiDialogs, TuiDropdowns],
  encapsulation: ViewEncapsulation.None,
})
export class AppRootComponent {}

