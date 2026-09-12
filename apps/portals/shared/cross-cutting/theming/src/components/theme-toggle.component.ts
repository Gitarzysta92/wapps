import { Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { TuiSwitch } from '@taiga-ui/kit';
import { THEME_PROVIDER_TOKEN } from '../constants';

@Component({
  selector: 'theme-toggle',
  standalone: true,
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  imports: [AsyncPipe, ReactiveFormsModule, TuiSwitch]
})
export class ThemeToggleComponent {
  public readonly themeProvider = inject(THEME_PROVIDER_TOKEN);
  protected readonly control = new FormControl(false, { nonNullable: true });
  private readonly isDark = toSignal(this.themeProvider.isToggled$, { initialValue: false });

  constructor() {
    effect(() => this.control.setValue(this.isDark(), { emitEvent: false }));
  }

  protected async onToggle(): Promise<void> {
    await this.themeProvider.toggle();
    this.control.setValue(this.isDark(), { emitEvent: false });
  }
}
