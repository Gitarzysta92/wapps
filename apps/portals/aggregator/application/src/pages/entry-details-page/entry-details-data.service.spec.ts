import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { EntryDetailsDataService, detailSlug } from './entry-details-data.service';

describe('EntryDetailsDataService', () => {
  let service: EntryDetailsDataService;
  let storage: Storage;
  beforeEach(() => {
    const records = new Map<string, string>();
    storage = {
      get length() { return records.size; },
      clear: () => records.clear(),
      getItem: key => records.get(key) ?? null,
      key: index => [...records.keys()][index] ?? null,
      removeItem: key => { records.delete(key); },
      setItem: (key, value) => { records.set(key, value); },
    };
    TestBed.configureTestingModule({ providers: [
      EntryDetailsDataService,
      { provide: DOCUMENT, useValue: { defaultView: { localStorage: storage } } },
    ] });
    service = TestBed.inject(EntryDetailsDataService);
  });

  it('resolves article slugs from discovery and feed and includes readable bodies', () => {
    for (const article of service.articles) {
      expect(service.article(article.slug)?.sections.length).toBeGreaterThan(0);
      expect(service.article(detailSlug(article.title))?.title).toBe(article.title);
      expect(article.excerpt).not.toContain('Lorem ipsum');
    }
    expect(service.article('unknown-article')).toBeUndefined();
    expect(service.suite('unknown-suite')).toBeUndefined();
  });

  it('saves drafts across service instances and exposes them to listings', () => {
    const suite = service.createSuite(' My tools ', ' My workflow ', ['photo-snap', 'photo-snap', 'not-a-real-app']);
    const restored = TestBed.runInInjectionContext(() => new EntryDetailsDataService());
    expect(restored.suite(suite.slug)?.title).toBe('My tools');
    expect(restored.listMySuites()[0].description).toBe('My workflow');
    expect(restored.listMySuites()[0].apps.map(app => app.slug)).toEqual(['photo-snap']);
    expect(restored.listSuites().filter(item => item.slug === suite.slug).length).toBe(1);
  });

  it('avoids collisions with fixture, reserved and existing draft slugs', () => {
    expect(service.createSuite('create', '', ['photo-snap']).slug).toBe('create-2');
    expect(service.createSuite('Productivity Suite', '', ['photo-snap']).slug).toBe('productivity-suite-2');
    expect(service.createSuite('Productivity Suite', '', ['photo-snap']).slug).toBe('productivity-suite-3');
  });

  it('rejects invalid drafts without persisting them', () => {
    expect(() => service.createSuite('   ', '', ['photo-snap'])).toThrow();
    expect(() => service.createSuite('Tools', '', [])).toThrow();
    expect(() => service.createSuite('Tools', '', ['unknown'])).toThrow();
    expect(() => service.createSuite('Tools', 'x'.repeat(1001), ['photo-snap'])).toThrow();
    expect(service.listMySuites()).toEqual([]);
  });

  it('handles corrupt storage and rejects malformed records', () => {
    storage.setItem('wapps.suite-drafts.v1', '{broken');
    expect(service.listMySuites()).toEqual([]);
    storage.setItem('wapps.suite-drafts.v1', JSON.stringify([null, { local: true, apps: [] }]));
    expect(service.listMySuites()).toEqual([]);
  });

  it('does not claim success when storage cannot be written', () => {
    storage.setItem = () => { throw new Error('Storage full'); };
    expect(() => service.createSuite('Tools', '', ['photo-snap'])).toThrow('Storage full');
    expect(service.listMySuites()).toEqual([]);
  });

  it('keeps fixture app links and deduplicates suites from discovery', () => {
    expect(service.suite('creative-tools-suite')?.apps[0].slug).toBe('photo-snap');
    const suites = service.listSuites();
    expect(new Set(suites.map(suite => suite.slug)).size).toBe(suites.length);
  });
});
