import { Injectable, signal } from '@angular/core';
import { APPLICATIONS, DISCUSSIONS } from '@portals/shared/data';
import { DiscussionThreadDto, DiscussionPreviewDto, DiscussionPostDto } from '@domains/discussion';

const KEY = 'wapps.local-discussions.v1';
const author = { id: 'local-reader', slug: 'local-reader', name: 'You (local)', avatar: { url: '' } };

/** Local-only drafts and replies; never represents a server submission. */
@Injectable({ providedIn: 'root' })
export class LocalDiscussionsService {
  readonly revision = signal(0);
  private read(): DiscussionThreadDto[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((d): d is DiscussionThreadDto => !!d && typeof d.id === 'string' && typeof d.slug === 'string'
        && typeof d.title === 'string' && typeof d.content === 'string' && Number.isFinite(new Date(d.publishedTime).getTime())
        && Array.isArray(d.tags) && d.tags.every((t: { slug: string; name: string }) => t && typeof t.slug === 'string' && typeof t.name === 'string')
        && typeof d.author?.name === 'string' && typeof d.author?.id === 'string' && typeof d.author?.avatar?.url === 'string' && Array.isArray(d.replies) && d.replies.every((r: DiscussionPostDto) =>
          r && typeof r.content === 'string' && typeof r.author?.name === 'string' && typeof r.author?.id === 'string' && typeof r.author?.avatar?.url === 'string' && typeof r.id === 'string' && Number.isFinite(new Date(r.publishedTime).getTime())))
        .map(d => ({ ...d, publishedTime: new Date(d.publishedTime), replies: d.replies.map(r => ({ ...r, publishedTime: new Date(r.publishedTime) })) }));
    } catch { return []; }
  }
  threads(slug: string | null): DiscussionThreadDto[] {
    this.revision();
    const app = APPLICATIONS.find(a => a.slug === slug);
    if (!app) return [];
    const saved = this.read();
    const overrides = new Map(saved.map(d => [d.id, d]));
    return [...DISCUSSIONS.map(d => overrides.get(d.id) ?? d), ...saved.filter(d => !DISCUSSIONS.some(seed => seed.id === d.id))]
      .filter(d => d.associationId === app.id).map(d => ({ ...structuredClone(d), repliesCount: d.replies.length }));
  }
  previews(slug: string | null): DiscussionPreviewDto[] {
    return this.threads(slug).map(d => ({ id: d.id, associationId: d.associationId, associationSlug: slug ?? '', slug: d.slug,
      title: d.title, author: d.author.name, authorAvatar: d.author.avatar.url, createdAt: d.publishedTime,
      repliesCount: d.replies.length, viewsCount: d.viewsCount, isPinned: d.isPinned, tags: d.tags.map(t => t.name), excerpt: d.content.slice(0, 160) }));
  }
  private save(thread: DiscussionThreadDto): void {
    const saved = this.read().filter(d => d.id !== thread.id);
    // A failed write throws: callers keep the form and show an error.
    localStorage.setItem(KEY, JSON.stringify([...saved, thread]));
    this.revision.update(v => v + 1);
  }
  create(slug: string, title: string, content: string): DiscussionThreadDto {
    const app = APPLICATIONS.find(a => a.slug === slug);
    if (!app || !title.trim() || !content.trim() || title.trim().length > 120 || content.trim().length > 5000) throw new Error('Invalid discussion');
    const id = crypto.randomUUID();
    const thread: DiscussionThreadDto = { id, slug: 'local-' + id, associationId: app.id, title: title.trim(), content: content.trim(), author,
      publishedTime: new Date(), upvotesCount: 0, downvotesCount: 0, isEdited: false, repliesCount: 0, viewsCount: 0,
      isPinned: false, isRootThread: true, tags: [], replies: [] };
    this.save(thread);
    return thread;
  }
  reply(appSlug: string, discussionSlug: string, content: string): void {
    const thread = this.threads(appSlug).find(d => d.slug === discussionSlug);
    if (!thread || !content.trim() || content.trim().length > 5000) throw new Error('Invalid reply');
    thread.replies.push({ id: crypto.randomUUID(), content: content.trim(), author, publishedTime: new Date(), upvotesCount: 0, downvotesCount: 0, isEdited: false });
    thread.repliesCount = thread.replies.length;
    this.save(thread);
  }
}
