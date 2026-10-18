import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { DISCUSSION_MENTION_LIMIT, discussionMentionProfiles } from '@domains/community';
import { MentionMembersService } from '../../application/mention-members.service';

@Component({
  selector: 'profile-mention-picker',
  standalone: true,
  imports: [FormsModule, TuiButton],
  providers: [MentionMembersService],
  templateUrl: './mention-member-picker.component.html',
  styleUrl: './mention-members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MentionMemberPickerComponent {
  readonly selected = model<string[]>([]);
  readonly disabled = input(false);
  readonly link = signal('');
  readonly members = inject(MentionMembersService);
  readonly limit = DISCUSSION_MENTION_LIMIT;
  constructor() {
    effect(() => {
      const ids = this.selected();
      untracked(() => this.members.loadNames(ids));
    });
  }
  add(id: string) {
    if (
      this.disabled() ||
      this.selected().length >= this.limit ||
      this.selected().includes(id)
    )
      return;
    this.selected.set(discussionMentionProfiles([...this.selected(), id]));
  }
  remove(id: string) {
    if (!this.disabled())
      this.selected.update((ids) => ids.filter((value) => value !== id));
  }
}
