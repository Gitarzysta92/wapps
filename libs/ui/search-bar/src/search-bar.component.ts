import { ChangeDetectionStrategy, Component, input, OnInit, output } from "@angular/core";
import { ReactiveFormsModule, FormControl, FormGroup } from "@angular/forms";
import { TuiTextfield } from "@taiga-ui/core";
import { TuiSearch } from "@taiga-ui/layout";
import { debounceTime } from "rxjs";
import { TuiTextfieldControllerModule} from '@taiga-ui/legacy';

@Component({
  selector: "search-bar",
  templateUrl: "search-bar.component.html",
  styleUrl: 'search-bar.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiSearch,
    ReactiveFormsModule,
    TuiTextfield,
    TuiTextfieldControllerModule,
  ],
})
export class SearchBarComponent implements OnInit
{ 
  public readonly initialValue = input<string | null>(null);
  public readonly onSearch = output<{ phrase: string }>();
  public readonly onFocus = output<boolean>();

  public readonly form = new FormGroup({
    search: new FormControl(this.initialValue())
  });
  
  ngOnInit(): void {
    this.form.controls.search.setValue(this.initialValue())
    this.form.valueChanges
      .pipe(debounceTime(300))
      .subscribe(v => this.onSearch.emit({ phrase: v.search as any }))
  }

}