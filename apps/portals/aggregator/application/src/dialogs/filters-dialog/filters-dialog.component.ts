import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { FiltersPanelComponent } from '../../partials/filters-panel/filters-panel.component';
import { TuiDialogContext } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';

@Component({
  selector: 'filters-dialog',
  templateUrl: './filters-dialog.component.html',
  styleUrl: './filters-dialog.component.scss',
  imports: [FiltersPanelComponent],
})
export class FiltersDialogComponent implements OnInit {
  public readonly context =
    injectContext<TuiDialogContext<unknown, { filterParams: Subject<any> }>>();
  filterParams: any;

  ngOnInit(): void {
    this.filterParams = this.context?.data?.filterParams;
  }
}
