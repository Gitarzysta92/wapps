import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiBadge } from '@taiga-ui/kit';

export interface ProfileBadge {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

@Component({
  selector: 'profile-badges',
  standalone: true,
  imports: [CommonModule, TuiBadge],
  templateUrl: './profile-badges.component.html',
  styleUrl: './profile-badges.component.scss',
})
export class ProfileBadgesComponent {
  badges = input<ProfileBadge[]>([]);
}
