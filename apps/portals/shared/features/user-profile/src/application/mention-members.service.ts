import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { distinctUntilChanged, forkJoin, Subscription } from 'rxjs';
import { discussionMentionProfiles, publicCommentId } from '@domains/community';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { MENTION_MEMBERS, type MentionMember } from './mention-members.port';

@Injectable()
export class MentionMembersService {
  private readonly port = inject(MENTION_MEMBERS);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private pageSub = new Subscription();
  private namesSub = new Subscription();
  private matchSub = new Subscription();
  private ids: string[] = [];
  private generation = 0;
  readonly names = signal<Record<string, string>>({});
  readonly namesError = signal('');
  readonly namesLoading = signal(false);
  readonly items = signal<MentionMember[]>([]);
  readonly after = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly opened = signal(false);
  readonly match = signal<MentionMember | null>(null);
  readonly finding = signal(false);
  readonly findError = signal('');
  constructor() {
    const session = this.session.token$
      .pipe(distinctUntilChanged())
      .subscribe(() => {
        this.cancel();
        this.loadNames(this.ids);
      });
    inject(DestroyRef).onDestroy(() => {
      session.unsubscribe();
      this.cancel();
    });
  }
  loadNames(input: string[]) {
    this.namesSub.unsubscribe();
    this.ids = discussionMentionProfiles(input);
    this.names.set({});
    this.namesError.set('');
    this.namesLoading.set(false);
    if (!this.ids.length) return;
    const generation = this.generation;
    this.namesLoading.set(true);
    this.namesSub = forkJoin(
      this.ids.map((id) => this.port.read(id))
    ).subscribe({
      next: (results) => {
        if (generation !== this.generation) return;
        this.namesLoading.set(false);
        if (results.some((row) => !row.ok)) {
          this.namesError.set(
            'Some mentioned members could not be checked. Try again.'
          );
          return;
        }
        const names: Record<string, string> = {};
        for (const row of results)
          if (row.ok && row.value) names[row.value.id] = row.value.name;
        this.names.set(names);
      },
      error: () => {
        this.namesLoading.set(false);
        this.namesError.set(
          'Mentioned members could not be checked. Try again.'
        );
      },
    });
  }
  browse(after: string | null = null) {
    this.pageSub.unsubscribe();
    this.opened.set(true);
    this.loading.set(true);
    this.error.set('');
    this.items.set([]);
    this.after.set(null);
    const generation = this.generation;
    this.pageSub = this.port.directory(after).subscribe({
      next: (result) => {
        if (generation !== this.generation) return;
        this.loading.set(false);
        if (result.ok) {
          this.items.set(result.value.items);
          this.after.set(result.value.after);
        } else this.error.set(result.error.message);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Members could not be loaded. Try again.');
      },
    });
  }
  find(link: string) {
    this.matchSub.unsubscribe();
    this.findError.set('');
    this.match.set(null);
    this.finding.set(false);
    let id: string;
    try {
      const url = new URL(link.trim(), 'https://profile.invalid');
      const match = /^\/profiles\/([^/]+)\/?$/.exec(url.pathname);
      if (!match || url.search || url.hash)
        throw new Error('Invalid profile link');
      id = publicCommentId(match[1]);
    } catch {
      this.findError.set('Paste the link from the member profile page.');
      return;
    }
    const generation = this.generation;
    this.finding.set(true);
    this.matchSub = this.port.read(id).subscribe({
      next: (result) => {
        if (generation !== this.generation) return;
        this.finding.set(false);
        if (result.ok && result.value) this.match.set(result.value);
        else
          this.findError.set(
            result.ok
              ? 'This profile is unavailable to you.'
              : result.error.message
          );
      },
      error: () => {
        this.finding.set(false);
        this.findError.set('This member could not be checked. Try again.');
      },
    });
  }
  private cancel() {
    this.generation++;
    this.pageSub.unsubscribe();
    this.namesSub.unsubscribe();
    this.matchSub.unsubscribe();
    this.items.set([]);
    this.after.set(null);
    this.names.set({});
    this.match.set(null);
    this.error.set('');
    this.findError.set('');
    this.loading.set(false);
    this.namesLoading.set(false);
    this.finding.set(false);
    this.opened.set(false);
  }
}
