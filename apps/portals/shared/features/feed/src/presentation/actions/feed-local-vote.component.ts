import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, OnChanges, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';

@Component({
  selector: 'feed-local-vote',
  standalone: true,
  imports: [TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="group" [attr.aria-label]="'Local votes for ' + title">
      <button tuiButton type="button" size="xs" appearance="flat" [attr.aria-pressed]="vote() === 1" [attr.aria-label]="'Upvote ' + title + ' locally'" (click)="choose(1)">↑ {{ upvotes + (vote() === 1 ? 1 : 0) }}</button>
      @if (allowDownvote) {
        <button tuiButton type="button" size="xs" appearance="flat" [attr.aria-pressed]="vote() === -1" [attr.aria-label]="'Downvote ' + title + ' locally'" (click)="choose(-1)">↓ {{ downvotes + (vote() === -1 ? 1 : 0) }}</button>
      }
      <small class="vote-scope">Local vote</small>
    </div>
    @if (message()) { <small role="status">{{ message() }}</small> }
  `,
  styleUrl: './feed-actions.scss',
})
export class FeedLocalVoteComponent implements OnChanges {
  @Input({ required: true }) itemId!: string;
  @Input() title = 'this item';
  @Input() upvotes = 0;
  @Input() downvotes = 0;
  @Input() allowDownvote = true;
  private readonly document = inject(DOCUMENT);
  readonly vote = signal(0);
  readonly message = signal('');
  ngOnChanges(): void {
    this.message.set('');
    try {
      const value = this.document.defaultView?.localStorage.getItem(`wapps.feed-vote.${this.itemId}`);
      this.vote.set(value === '1' ? 1 : value === '-1' ? -1 : 0);
    } catch { this.vote.set(0); }
  }
  choose(value: number): void {
    const next = this.vote() === value ? 0 : value;
    this.vote.set(next);
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(`wapps.feed-vote.${this.itemId}`, String(next));
      this.message.set(next ? 'Vote saved in this browser only.' : 'Local vote removed.');
    } catch { this.message.set('Vote changed for this view only; browser storage is unavailable.'); }
  }
}
