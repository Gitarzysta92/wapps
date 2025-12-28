import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiAvatar } from '@taiga-ui/kit';
import { TuiHint } from '@taiga-ui/core';

export interface SuiteApp {
  slug: string;
  name: string;
  avatarUrl: string;
}

@Component({
  selector: 'suite-app-avatars',
  standalone: true,
  imports: [CommonModule, TuiAvatar, TuiHint],
  templateUrl: './suite-app-avatars.component.html',
  styleUrl: './suite-app-avatars.component.scss'
})
export class SuiteAppAvatarsComponent {
  apps = input.required<SuiteApp[]>();
  maxVisible = input<number>(6);
}

