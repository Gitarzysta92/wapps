import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { AccountExportEditorService } from '../../../application/account-export-editor.service';

@Component({
  selector: 'account-export-panel',
  imports: [TuiButton, DatePipe, DecimalPipe],
  providers: [AccountExportEditorService],
  templateUrl: './account-export-panel.component.html',
  styleUrl: './account-export-panel.component.scss',
})
export class AccountExportPanelComponent {
  readonly exporter = inject(AccountExportEditorService);
}
