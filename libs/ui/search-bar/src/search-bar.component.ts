import { ChangeDetectionStrategy, Component, input, OnDestroy, OnInit, output } from "@angular/core";
import { ReactiveFormsModule, FormControl, FormGroup } from "@angular/forms";
import { TuiTextfield } from "@taiga-ui/core";
import { TuiSearch } from "@taiga-ui/layout";
import { debounceTime, Subscription } from "rxjs";
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
export class SearchBarComponent implements OnInit, OnDestroy
{
  
  public readonly initialValue = input<string | null>(null);
  public readonly onSearch = output<string | null>();
  public readonly onFocus = output<boolean>();

  public readonly form = new FormGroup({
    search: new FormControl(this.initialValue())
  });
  private _valueChangesSubscription: Subscription | undefined;
  
  ngOnInit(): void {
    this.form.controls.search.setValue(this.initialValue())
    this._valueChangesSubscription = this.form.valueChanges
      .pipe(debounceTime(300))
      .subscribe(v => this.onSearch.emit(v.search ?? null))
  }

  ngOnDestroy(): void {
    this._valueChangesSubscription?.unsubscribe();
  } 

}