import type { ProfileArticlesPage } from '@domains/publication/article';
import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { distinctUntilChanged, Subscription } from 'rxjs';
import type { PublicProfileFavoritesPage } from '@domains/customer/favorites';
import type { ProfileSuitesPage } from '@domains/publication/suite';
import type { ProfileDiscussionsPage } from '@domains/community';
import type {
  ProfileDirectory,
  ProfileActivityPage,
  ProfileFollow,
  ProfileFollowAction,
  ProfileFollowChange,
  ProfileFollowerList,
  ProfileFollowingList,
} from '@domains/customer/profiles';
import {
  PUBLIC_PROFILE_PORT,
  PUBLIC_PROFILE_SESSION,
  type PublicProfileRead,
} from './public-profile.port';

@Injectable()
export class PublicProfileService {
  private readonly port = inject(PUBLIC_PROFILE_PORT);
  private readonly session = inject(PUBLIC_PROFILE_SESSION);
  readonly profile = signal<PublicProfileRead | null>(null);
  readonly status = signal<'loading' | 'ready' | 'missing' | 'unavailable'>(
    'loading'
  );
  readonly directory = signal<ProfileDirectory | null>(null);
  readonly directoryStatus = signal<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  readonly followers = signal<ProfileFollowerList | null>(null);
  readonly followersStatus = signal<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  readonly following = signal<ProfileFollowingList | null>(null);
  readonly followingStatus = signal<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  readonly signedIn = signal(false);
  readonly activity = signal<ProfileActivityPage | null>(null);
  readonly activityStatus = signal<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  readonly favorites = signal<PublicProfileFavoritesPage | null>(null);
  readonly articles = signal<ProfileArticlesPage | null>(null);
  readonly articlesStatus = signal<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  readonly suites = signal<ProfileSuitesPage | null>(null);
  readonly discussions = signal<ProfileDiscussionsPage | null>(null);
  readonly discussionsStatus = signal<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  readonly suitesStatus = signal<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  readonly favoritesStatus = signal<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  readonly saving = signal(false);
  readonly feedback = signal('');
  readonly conflict = signal(false);
  readonly uncertain = signal(false);
  readonly blocked = computed(
    () => this.saving() || this.conflict() || this.uncertain()
  );
  private id: string | null = null;
  private readSub = new Subscription();
  private directorySub = new Subscription();
  private followersSub = new Subscription();
  private followingSub = new Subscription();
  private writeSub = new Subscription();
  private favoritesSub = new Subscription();
  private articlesSub = new Subscription();
  private suitesSub = new Subscription();
  private discussionsSub = new Subscription();
  private activitySub = new Subscription();
  private attempt: {
    input: ProfileFollowChange;
    key: string;
    session: string;
  } | null = null;

  constructor() {
    const sessionSub = this.session.key$
      .pipe(distinctUntilChanged())
      .subscribe((key) => {
        this.cancel();
        this.signedIn.set(key !== null);
        if (this.id) this.open(this.id);
      });
    inject(DestroyRef).onDestroy(() => {
      sessionSub.unsubscribe();
      this.cancel();
    });
  }

  open(id: string): void {
    this.cancel();
    this.id = id;
    this.load();
    this.loadDirectory();
  }
  reload(): void {
    if (this.id) this.open(this.id);
  }

  private load(): void {
    if (!this.id) return;
    this.activitySub.unsubscribe();
    this.activity.set(null);
    this.activityStatus.set('loading');
    this.readSub.unsubscribe();
    this.port.releasePhoto();
    this.profile.set(null);
    this.favoritesSub.unsubscribe();
    this.favorites.set(null);
    this.favoritesStatus.set('loading');
    this.articlesSub.unsubscribe();
    this.articles.set(null);
    this.articlesStatus.set('loading');
    this.suitesSub.unsubscribe();
    this.suites.set(null);
    this.suitesStatus.set('loading');
    this.discussionsSub.unsubscribe();
    this.discussions.set(null);
    this.discussionsStatus.set('loading');
    this.status.set('loading');
    this.readSub = this.port.read(this.id).subscribe((result) => {
      if (!result.ok) {
        this.status.set(
          result.error.reason === 'missing' ? 'missing' : 'unavailable'
        );
        return;
      }
      this.profile.set(result.value);
      this.status.set('ready');
      if (result.value.profile) this.loadFavorites();
      if (result.value.profile) this.loadSuites();
      if (result.value.profile) this.loadArticles();
      if (result.value.profile) this.loadDiscussions();
      if (result.value.profile) this.loadActivity();
      if (result.value.view.isOwner) {
        this.loadFollowers();
        this.loadFollowing();
      }
    });
  }

  loadDirectory(after: string | null = null): void {
    this.directorySub.unsubscribe();
    this.directory.set(null);
    this.directoryStatus.set('loading');
    this.directorySub = this.port.directory(after).subscribe((result) => {
      if (!result.ok) {
        this.directoryStatus.set('unavailable');
        return;
      }
      this.directory.set(result.value);
      this.directoryStatus.set('ready');
    });
  }
  loadActivity(after: string | null = null): void {
    if (!this.id || !this.profile()?.profile) return;
    this.activitySub.unsubscribe();
    this.activity.set(null);
    this.activityStatus.set('loading');
    this.activitySub = this.port
      .activity(this.id, after)
      .subscribe((result) => {
        if (!result.ok) {
          this.activityStatus.set('unavailable');
          return;
        }
        this.activity.set(result.value);
        this.activityStatus.set('ready');
      });
  }
  loadFavorites(after: string | null = null): void {
    if (!this.id || !this.profile()?.profile) return;
    this.favoritesSub.unsubscribe();
    this.favorites.set(null);
    this.favoritesStatus.set('loading');
    this.favoritesSub = this.port
      .favorites(this.id, after)
      .subscribe((result) => {
        if (!result.ok) {
          this.favoritesStatus.set('unavailable');
          return;
        }
        this.favorites.set(result.value);
        this.favoritesStatus.set('ready');
      });
  }
  loadFollowers(after: string | null = null): void {
    this.followersSub.unsubscribe();
    this.followers.set(null);
    this.followersStatus.set('loading');
    this.followersSub = this.port.followers(after).subscribe((result) => {
      if (!result.ok) {
        this.followersStatus.set('unavailable');
        return;
      }
      this.followers.set(result.value);
      this.followersStatus.set('ready');
    });
  }
  loadArticles(after: string | null = null): void {
    if (!this.id || !this.profile()?.profile) return;
    this.articlesSub.unsubscribe();
    this.articles.set(null);
    this.articlesStatus.set('loading');
    this.articlesSub = this.port
      .articles(this.id, after)
      .subscribe((result) => {
        if (!result.ok) {
          this.articlesStatus.set('unavailable');
          return;
        }
        this.articles.set(result.value);
        this.articlesStatus.set('ready');
      });
  }
  loadSuites(after: string | null = null): void {
    if (!this.id || !this.profile()?.profile) return;
    this.suitesSub.unsubscribe();
    this.suites.set(null);
    this.suitesStatus.set('loading');
    this.suitesSub = this.port.suites(this.id, after).subscribe((result) => {
      if (!result.ok) {
        this.suitesStatus.set('unavailable');
        return;
      }
      this.suites.set(result.value);
      this.suitesStatus.set('ready');
    });
  }
  loadDiscussions(after: string | null = null): void {
    if (!this.id || !this.profile()?.profile) return;
    this.discussionsSub.unsubscribe();
    this.discussions.set(null);
    this.discussionsStatus.set('loading');
    this.discussionsSub = this.port
      .discussions(this.id, after)
      .subscribe((result) => {
        if (!result.ok) {
          this.discussionsStatus.set('unavailable');
          return;
        }
        this.discussions.set(result.value);
        this.discussionsStatus.set('ready');
      });
  }
  loadFollowing(after: string | null = null): void {
    this.followingSub.unsubscribe();
    this.following.set(null);
    this.followingStatus.set('loading');
    this.followingSub = this.port.following(after).subscribe((result) => {
      if (!result.ok) {
        this.followingStatus.set('unavailable');
        return;
      }
      this.following.set(result.value);
      this.followingStatus.set('ready');
    });
  }

  change(follow: ProfileFollow, action: ProfileFollowAction): void {
    const session = this.session.currentKey();
    if (!session || this.blocked()) return;
    this.attempt = {
      input: {
        ownerId: follow.ownerId,
        requesterId: follow.requesterId,
        expectedRevision: follow.revision,
        action,
      },
      key: crypto.randomUUID(),
      session,
    };
    this.send();
  }
  retry(): void {
    if (this.uncertain() && !this.saving()) this.send();
  }

  private send(): void {
    const attempt = this.attempt;
    if (!attempt || attempt.session !== this.session.currentKey()) return;
    this.saving.set(true);
    this.feedback.set('Saving follower access...');
    this.writeSub = this.port
      .change(attempt.input, attempt.key)
      .subscribe((result) => {
        if (
          attempt !== this.attempt ||
          attempt.session !== this.session.currentKey()
        )
          return;
        this.saving.set(false);
        if (!result.ok) {
          this.feedback.set(result.error.message);
          this.conflict.set(result.error.reason === 'conflict');
          this.uncertain.set(result.error.reason === 'unavailable');
          if (!this.conflict() && !this.uncertain()) this.attempt = null;
          return;
        }
        this.attempt = null;
        this.uncertain.set(false);
        this.conflict.set(false);
        this.feedback.set('Follower access saved.');
        this.load();
      });
  }

  private cancel(): void {
    this.activitySub.unsubscribe();
    this.activity.set(null);
    this.discussionsSub.unsubscribe();
    this.discussions.set(null);
    this.articlesSub.unsubscribe();
    this.articles.set(null);
    this.articlesStatus.set('loading');
    this.suitesSub.unsubscribe();
    this.suites.set(null);
    this.readSub.unsubscribe();
    this.directorySub.unsubscribe();
    this.followersSub.unsubscribe();
    this.followingSub.unsubscribe();
    this.writeSub.unsubscribe();
    this.favoritesSub.unsubscribe();
    this.port.releasePhoto();
    this.attempt = null;
    this.profile.set(null);
    this.favorites.set(null);
    this.directory.set(null);
    this.followers.set(null);
    this.following.set(null);
    this.feedback.set('');
    this.saving.set(false);
    this.conflict.set(false);
    this.uncertain.set(false);
  }
}
