import { Directive, Input, signal, computed } from '@angular/core';

export interface VotingData {
  upvotes: number;
  downvotes: number;
  userVote?: 'upvote' | 'downvote' | null;
}

@Directive({
  selector: '[votingContainer]',
  standalone: true,
  exportAs: 'votingContainer'
})
export class VotingContainerDirective {
  private votingData = signal<VotingData>({ upvotes: 0, downvotes: 0, userVote: null });

  @Input() set votingContainer(data: VotingData | undefined) {
    if (data) {
      this.votingData.set(data);
    }
  }

  upvotesCount = computed(() => this.votingData().upvotes);
  downvotesCount = computed(() => this.votingData().downvotes);
  userVote = computed(() => this.votingData().userVote);

  upvote(): void {
    const current = this.votingData();
    if (current.userVote === 'upvote') {
      // Remove upvote
      this.votingData.set({
        ...current,
        upvotes: current.upvotes - 1,
        userVote: null
      });
    } else if (current.userVote === 'downvote') {
      // Switch from downvote to upvote
      this.votingData.set({
        ...current,
        upvotes: current.upvotes + 1,
        downvotes: current.downvotes - 1,
        userVote: 'upvote'
      });
    } else {
      // Add upvote
      this.votingData.set({
        ...current,
        upvotes: current.upvotes + 1,
        userVote: 'upvote'
      });
    }
  }

  downvote(): void {
    const current = this.votingData();
    if (current.userVote === 'downvote') {
      // Remove downvote
      this.votingData.set({
        ...current,
        downvotes: current.downvotes - 1,
        userVote: null
      });
    } else if (current.userVote === 'upvote') {
      // Switch from upvote to downvote
      this.votingData.set({
        ...current,
        upvotes: current.upvotes - 1,
        downvotes: current.downvotes + 1,
        userVote: 'downvote'
      });
    } else {
      // Add downvote
      this.votingData.set({
        ...current,
        downvotes: current.downvotes + 1,
        userVote: 'downvote'
      });
    }
  }
}
