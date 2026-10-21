import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import { TuiCardLarge } from '@taiga-ui/layout';
import { AccountErasureService } from '../../../application/account-erasure.service';

@Component({
  selector: 'account-erasure-panel',
  imports: [FormsModule, TuiAppearance, TuiButton, TuiCardLarge],
  templateUrl: './account-erasure-panel.component.html',
  styleUrl: './account-erasure-panel.component.scss',
})
export class AccountErasurePanelComponent {
  readonly erasure = inject(AccountErasureService);
  readonly confirmation = signal('');
  readonly understood = signal(false);
  begin(): void {
    this.confirmation.set('');
    this.understood.set(false);
    this.erasure.begin();
  }
}
