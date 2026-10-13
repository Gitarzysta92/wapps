import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiLink } from '@taiga-ui/core';
import { MentionMembersService } from '../../application/mention-members.service';

@Component({
  selector: 'profile-mentioned-members',
  standalone: true,
  imports: [RouterLink, TuiButton, TuiLink],
  providers: [MentionMembersService],
  templateUrl: './mentioned-members.component.html',
  styleUrl: './mention-members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MentionedMembersComponent {
  readonly ids = input.required<string[]>();
  readonly expanded = signal(false);
  readonly members = inject(MentionMembersService);
  constructor() {
    effect(() => {
      const ids = this.ids();
      const open = this.expanded();
      untracked(() => this.members.loadNames(open ? ids : []));
    });
  }
}
