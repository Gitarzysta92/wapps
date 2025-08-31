import { Component, inject } from "@angular/core";
import { THEME_PROVIDER_TOKEN } from "../constants";
import { AsyncPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TuiSwitch } from "@taiga-ui/kit";

@Component({
  selector: "theme-toggle",
  standalone: true,
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  imports: [
    AsyncPipe,
    FormsModule,
    TuiSwitch
  ]
})
export class ThemeToggleComponent {
  public readonly themeProvider = inject(THEME_PROVIDER_TOKEN); 
}