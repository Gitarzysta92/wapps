import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FEED_ITEM_EXAMPLES, SAMPLE_DISCUSSION } from '@portals/shared/data';
import { LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { CATALOG_ENTRIES } from '@portals/shared/features/listing';
import { buildDigestContent } from './digest-content';
import { DigestPageComponent } from './digest-page.component';
import { EntryDetailsDataService } from '../entry-details-page/entry-details-data.service';

describe('Digest overview', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('takes the three latest Explore updates without reordering the shared feed', () => {
    const feed = [...FEED_ITEM_EXAMPLES].reverse();
    const ids = feed.map(item => item.id);
    const content = buildDigestContent(feed);
    expect(feed.map(item => item.id)).toEqual(ids);
    expect(content.latest.map(item => item.id)).toEqual(['app-review-1', 'dev-log-1', 'app-health-1']);
    expect(content.latest.map(item => item.link)).toEqual([
      '/apps/photo-snap/reviews', '/apps/photo-snap/devlog/2.1.0', '/apps/photo-snap/health',
    ]);
  });

  it('shows the newest articles, with links to existing detail records', () => {
    const content = buildDigestContent();
    expect(content.articles.map(article => article.slug)).toEqual(['design-principles-modern-apps', 'tech-trends-2024']);
    const details = TestBed.inject(EntryDetailsDataService);
    for (const article of content.articles) expect(details.article(article.slug)).toBeDefined();
    expect(CATALOG_ENTRIES.filter(entry => entry.kind === 'articles').length).toBeGreaterThan(content.articles.length);
  });

  it('shows each application once and sends conversations to their application context', () => {
    const content = buildDigestContent();
    expect(content.applications.map(app => app.slug)).toEqual(['photo-snap', 'quick-task']);
    expect(content.discussions).toHaveLength(1);
    expect(content.discussions[0].link).toBe(`/apps/photo-snap/discussions/${SAMPLE_DISCUSSION.slug}`);
    expect(content.discussions[0].title).toBe(SAMPLE_DISCUSSION.title);
    expect(TestBed.inject(LocalDiscussionsService).threads('photo-snap').some(thread => thread.slug === SAMPLE_DISCUSSION.slug)).toBe(true);
  });

  it('handles an empty portal without generating placeholder content', () => {
    expect(buildDigestContent([], [])).toEqual({ latest: [], articles: [], applications: [], discussions: [] });
  });

  it('renders compact sections and direct links without catalog controls or a feed wall', () => {
    const fixture = TestBed.createComponent(DigestPageComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('h1')?.textContent).toBe('Digest');
    expect([...root.querySelectorAll('h2')].map(title => title.textContent?.trim()))
      .toEqual(['Latest', 'Articles', 'Applications', 'Discussions']);
    expect(root.querySelectorAll('.digest-card')).toHaveLength(8);
    expect(root.querySelector('results-page, feed-container, select')).toBeNull();
    expect(root.querySelector('a[href="/articles"]')).toBeTruthy();
    expect(root.querySelector('a[href="/discover?type=application"]')).toBeTruthy();
    expect(root.querySelector('a[href="/apps/photo-snap/devlog/2.1.0"]')).toBeTruthy();
    expect([...root.querySelectorAll('a')].every(link => !!link.getAttribute('href'))).toBe(true);
  });

  it('keeps an article readable when its cover image fails', () => {
    const fixture = TestBed.createComponent(DigestPageComponent);
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('.article-cover') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.article-cover--fallback')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Design Principles for Modern Applications');
  });
});
