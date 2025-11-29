import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiPlatform, TuiVisualViewport } from '@taiga-ui/cdk';
import { TuiDialogs, TuiDropdowns } from '@taiga-ui/core';
import { NAVIGATION_CONFIGURATION } from '@ui/navigation';
import { THEME_PROVIDER_TOKEN, THEME_PROVIDER_CFG_TOKEN, ThemingDescriptorDirective, ThemingService } from '@portals/cross-cutting/theming';
import { GlobalStateService } from './state/global-state.service';
import { NAVIGATION } from './navigation';


@Component({
  selector: "body",
  templateUrl: "app-root.component.html",
  styleUrl: "styles.scss",
  standalone: true,
  hostDirectives: [
    TuiPlatform,
    TuiVisualViewport,
    ThemingDescriptorDirective
  ],
  imports: [
    RouterOutlet,
    TuiDialogs,
    TuiDropdowns,
  ],
  providers: [
    { provide: THEME_PROVIDER_TOKEN, useClass: ThemingService },
    {
      provide: THEME_PROVIDER_CFG_TOKEN,
      useValue: {
        darkThemeName: 'dark',
        lightThemeName: 'light',
        attributeName: 'tuiTheme'
      }
    },
    GlobalStateService,
    { provide: NAVIGATION_CONFIGURATION, useValue: NAVIGATION },
  ],
  encapsulation: ViewEncapsulation.None
})
export class AppRootComponent {
  // constructor(
  //   private router: Router,
  //   private route: ActivatedRoute
  // ) {}

  // ngOnInit(): void {
  //   // this.router.events
  //   //   .pipe(
  //   //     filter(e => e instanceof NavigationEnd),
  //     map(e => e)
  //   //   )
  //   //   .subscribe(() => {
  //   //     if (component) {
  //   //       this.dialogs.open(component, { label: 'Dialog via Routing' }).subscribe(() => {
  //   //         this.router.navigate([{ outlets: { dialog: null } }]); // Close dialog on dismiss
  //       });
  //   //     }  
  //   //   });
  // }
}