import { Component, input } from '@angular/core';
import { TuiAvatar } from '@taiga-ui/kit';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [TuiAvatar],
  templateUrl: './app-avatar.component.html',
  styleUrl: './app-avatar.component.scss'
})
export class AppAvatarComponent {
  avatar = input.required<{ url: string; alt: string }>();
  size = input<'xs' | 's' | 'm' | 'l' | 'xl'>('m');
}

