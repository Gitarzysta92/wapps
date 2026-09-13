import { Component, computed, input, output } from '@angular/core';
import { TuiButton, TuiLoader, TuiIcon } from '@taiga-ui/core';
import { AuthenticationProvider, AuthenticationMethodDto } from '@domains/identity/authentication';

@Component({
  selector: 'provider-buttons',
  template: `
    @if (providers().length) {
      <div class="provider-buttons">
        @for (method of providers(); track method.provider) {
          <button tuiButton type="button" size="m" appearance="outline"
            [disabled]="authenticatingProvider() !== null"
            (click)="onProviderClick.emit(method.provider)">
            <tui-loader class="loader" [inheritColor]="true" [overlay]="true"
              [showLoader]="authenticatingProvider() === method.provider" />
            @if (method.provider === AuthenticationProvider.GOOGLE) {
              <svg class="provider-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92a5.07 5.07 0 0 1-2.2 3.33v2.77h3.56c2.08-1.92 3.28-4.75 3.28-7.97ZM12 23c2.97 0 5.46-.98 7.28-2.78l-3.56-2.77c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23ZM5.84 13.98A6.6 6.6 0 0 1 5.5 12c0-.69.12-1.36.34-1.98V7.18H2.18A11 11 0 0 0 1 12c0 1.78.42 3.47 1.18 4.82l3.66-2.84ZM12 5.49c1.62 0 3.07.56 4.21 1.66l3.16-3.16A10.6 10.6 0 0 0 12 1a11 11 0 0 0-9.82 6.18l3.66 2.84C6.71 7.42 9.14 5.49 12 5.49Z" />
              </svg>
            } @else if (method.icon) {
              <tui-icon [icon]="getIcon(method.icon)" class="provider-icon" />
            }
            {{ method.displayName }}
          </button>
        }
      </div>
    }
    @if (guestMethod(); as guest) {
      <div class="guest-action">
        <button tuiButton type="button" size="m" appearance="flat"
          [disabled]="authenticatingProvider() !== null"
          (click)="onProviderClick.emit(guest.provider)">
          <tui-loader class="loader" [inheritColor]="true" [overlay]="true"
            [showLoader]="authenticatingProvider() === guest.provider" />
          Continue as guest
        </button>
      </div>
    }
  `,
  styleUrl: './provider-buttons.component.scss',
  standalone: true,
  imports: [TuiButton, TuiLoader, TuiIcon]
})
export class ProviderButtonsComponent {
  public methods = input.required<AuthenticationMethodDto[]>();
  public authenticatingProvider = input<AuthenticationProvider | null>(null);
  public onProviderClick = output<AuthenticationProvider>();
  public readonly AuthenticationProvider = AuthenticationProvider;
  public readonly providers = computed(() => this.methods().filter(method => method.enabled &&
    method.provider !== AuthenticationProvider.EMAIL_PASSWORD && method.provider !== AuthenticationProvider.ANONYMOUS));
  public readonly guestMethod = computed(() => this.methods().find(method => method.enabled &&
    method.provider === AuthenticationProvider.ANONYMOUS));

  getIcon(icon: string): string {
    return icon.startsWith('@tui.') ? icon : `@tui.${icon}`;
  }
}
