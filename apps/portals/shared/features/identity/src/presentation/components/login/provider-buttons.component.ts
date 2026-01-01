import { Component, input, output } from "@angular/core";
import { TuiButton, TuiLoader, TuiIcon } from "@taiga-ui/core";
import { AuthenticationProvider, AuthenticationMethodDto } from "@domains/identity/authentication";

@Component({
  selector: "provider-buttons",
  template: `
    <div class="provider-buttons">
      @for (method of methods(); track method.provider) {
        @if (method.provider !== 'EMAIL_PASSWORD') {
          <button
            tuiButton
            type="button"
            size="l"
            appearance="outline"
            [disabled]="authenticatingProvider() === method.provider"
            (click)="onProviderClick.emit(method.provider)"
            [class]="'provider-button provider-button--' + method.provider.toLowerCase()">
            <tui-loader
              [inheritColor]="true"
              [overlay]="true"
              [showLoader]="authenticatingProvider() === method.provider"/>
            @if (method.icon) {
              <tui-icon [icon]="getIcon(method.icon)" class="provider-icon" />
            }
            <span class="provider-label">{{ method.displayName }}</span>
          </button>
        }
      }
    </div>
  `,
  styles: [`
    .provider-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .provider-button {
      width: 100%;
      justify-content: center;
      position: relative;
      transition: all 0.2s ease;
    }
    
    .provider-icon {
      margin-right: 0.5rem;
    }
    
    .provider-label {
      flex: 1;
      text-align: center;
    }

    /* Provider-specific styling */
    .provider-button--google {
      --tui-text-action: #4285F4;
      border-color: #4285F4;
      
      &:hover:not(:disabled) {
        background-color: #4285F4;
        color: white;
        --tui-text-action: white;
      }
    }

    .provider-button--facebook {
      --tui-text-action: #1877F2;
      border-color: #1877F2;
      
      &:hover:not(:disabled) {
        background-color: #1877F2;
        color: white;
        --tui-text-action: white;
      }
    }

    .provider-button--github {
      --tui-text-action: #333;
      border-color: #333;
      
      &:hover:not(:disabled) {
        background-color: #333;
        color: white;
        --tui-text-action: white;
      }
    }

    .provider-button--apple {
      --tui-text-action: #000;
      border-color: #000;
      
      &:hover:not(:disabled) {
        background-color: #000;
        color: white;
        --tui-text-action: white;
      }
    }

    .provider-button--anonymous {
      border-style: dashed;
      opacity: 0.8;
      
      &:hover:not(:disabled) {
        opacity: 1;
      }
    }
  `],
  standalone: true,
  imports: [TuiButton, TuiLoader, TuiIcon]
})
export class ProviderButtonsComponent {
  public methods = input.required<AuthenticationMethodDto[]>();
  public authenticatingProvider = input<AuthenticationProvider | null>(null);
  public onProviderClick = output<AuthenticationProvider>();
  
  getIcon(icon: string): string {
    // Map provider icons to Taiga UI icons
    const iconMap: Record<string, string> = {
      'google': '@tui.globe',
      'github': '@tui.github',
      'facebook': '@tui.facebook',
      'apple': '@tui.apple',
      'mail': '@tui.mail',
      'user': '@tui.user'
    };
    
    return iconMap[icon] || `@tui.${icon}`;
  }
}

