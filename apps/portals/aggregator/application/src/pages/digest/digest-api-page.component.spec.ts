import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { provideArticles } from '@portals/shared/features/articles';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import type { DigestContent } from '@domains/feed';
import { DigestService } from '@portals/shared/features/feed';
import { DigestApiPageComponent } from './digest-api-page.component';

describe('API Digest page states', () => {
  function setup() {
    const digest = {
      loading: signal(false),
      error: signal(''),
      content: signal<DigestContent | null>(null),
      order: signal('recent'),
      personalizationDisabled: signal(false),
      reload: jest.fn(),
      retry: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideArticles({ mode: 'api', apiBaseUrl: '' }).providers,
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: of(null), getToken: () => null },
        },
      ],
    });
    TestBed.overrideComponent(DigestApiPageComponent, {
      remove: { providers: [DigestService] },
      add: { providers: [{ provide: DigestService, useValue: digest }] },
    });
    const fixture = TestBed.createComponent(DigestApiPageComponent);
    return { digest, fixture, root: fixture.nativeElement as HTMLElement };
  }
  it('shows loading and retryable failures without demonstration cards', () => {
    const h = setup();
    h.digest.loading.set(true);
    h.fixture.detectChanges();
    expect(h.root.textContent).toContain('Loading Digest');
    h.digest.loading.set(false);
    h.digest.error.set('A required service is unavailable.');
    h.fixture.detectChanges();
    expect(h.root.textContent).toContain('Digest unavailable');
    expect(h.root.querySelectorAll('.digest-card')).toHaveLength(0);
    [...h.root.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Retry Digest')!
      .click();
    expect(h.digest.retry).toHaveBeenCalled();
  });
  it('composes the real cover adapter and retains article text and its link after a cover outage', () => {
    const h = setup();
    const id = '10000000-0000-4000-8000-000000000001',
      imageId = '10000000-0000-4000-8000-000000000002';
    h.digest.content.set({
      latest: { items: [], more: false },
      discussions: { items: [], more: false },
      applications: { items: [], more: false },
      articles: {
        more: false,
        items: [
          {
            id,
            revision: 1,
            submittedRevision: 1,
            publishedAt: 1000,
            updatedAt: 1000,
            title: 'Published article',
            slug: 'published-article',
            excerpt: 'Actual public summary',
            byline: 'Author',
            category: 'Guides',
            tags: [],
            cover: { imageId, alt: 'Cover' },
          },
        ],
      },
    });
    h.fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/media/articles/${id}/${imageId}`)
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    h.fixture.detectChanges();
    expect(h.root.textContent).toContain('Actual public summary');
    expect(
      h.root.querySelector('a[href="/articles/published-article"]')
    ).toBeTruthy();
    expect(
      h.root.querySelector('article-cover-image + .article-cover--fallback')
    ).toBeTruthy();
    expect(h.root.textContent).toContain('Retry article cover');
    TestBed.inject(HttpTestingController).verify();
  });
  it('keeps empty copy selection-specific and preserves popular headings when personalization is off', () => {
    const h = setup();
    h.digest.content.set({
      latest: { items: [], more: true },
      articles: { items: [], more: true },
      applications: { items: [], more: true },
      discussions: { items: [], more: true },
    });
    h.digest.order.set('popular');
    h.digest.personalizationDisabled.set(true);
    h.fixture.detectChanges();
    expect(h.root.querySelector('#latest-title')?.textContent).toBe(
      'Selected activity'
    );
    expect(h.root.querySelectorAll('ui-content-state')).toHaveLength(4);
    expect(h.root.textContent).toContain('in this selection');
    expect(h.root.textContent).not.toContain('PhotoSnap');
    h.digest.order.set('recommended');
    h.fixture.detectChanges();
    expect(h.root.querySelector('#latest-title')?.textContent).toBe('Latest');
    expect(h.root.textContent).toContain('Personalization is off');
  });
});
