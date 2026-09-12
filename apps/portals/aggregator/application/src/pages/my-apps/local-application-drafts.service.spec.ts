import { TestBed } from '@angular/core/testing';
import {
  APPLICATION_DRAFT_STORAGE,
  APPLICATION_DRAFT_STORAGE_KEY,
  ApplicationDraftInput,
  LocalApplicationDraftsService,
} from './local-application-drafts.service';

const valid: ApplicationDraftInput = {
  name: 'Example App',
  slug: 'example-app',
  website: 'https://example.com',
  description: 'An application for organizing collaborative projects.',
};

function createService(
  storage: Storage | null = localStorage
): LocalApplicationDraftsService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: APPLICATION_DRAFT_STORAGE, useValue: storage }],
  });
  return TestBed.inject(LocalApplicationDraftsService);
}

describe('Local application drafts', () => {
  beforeEach(() => localStorage.clear());

  it('persists a draft across instances, updates it without duplication, and deletes it', () => {
    let service = createService();
    const draft = service.saveApplication({
      ...valid,
      name: '  Example App  ',
    })!;
    expect(draft.name).toBe(valid.name);
    service = createService();
    expect(service.data().applications).toEqual([draft]);
    const updated = service.saveApplication(
      { ...valid, name: 'Updated App' },
      draft.id
    )!;
    expect(updated.id).toBe(draft.id);
    expect(updated.createdAt).toBe(draft.createdAt);
    expect(service.data().applications.length).toBe(1);
    expect(createService().data().applications[0].name).toBe('Updated App');
    expect(service.removeApplication(draft.id)).toBe(true);
    expect(createService().data().applications).toEqual([]);
  });

  it('rejects invalid values, unsafe URLs, duplicate slugs, and stale edit IDs', () => {
    const service = createService();
    for (const patch of [
      { name: '  ' },
      { slug: '../register' },
      { slug: 'bad--slug' },
      { website: 'javascript:alert(1)' },
      { website: 'https://user:secret@example.com' },
      { description: 'short' },
    ])
      expect(service.saveApplication({ ...valid, ...patch })).toBeNull();
    const draft = service.saveApplication(valid)!;
    expect(service.saveApplication(valid)).toBeNull();
    expect(
      service.saveApplication({ ...valid, slug: 'second-app' }, 'missing-id')
    ).toBeNull();
    expect(createService().data().applications).toEqual([draft]);
  });

  it('keeps ownership notes separate from registrations and never grants ownership', () => {
    const service = createService();
    expect(
      service.saveOwnership('catalog-app', valid.website, valid.description)
    ).toBe(true);
    expect(service.data().applications).toEqual([]);
    const notes = createService().data().ownership[0];
    expect(Object.keys(notes).sort()).toEqual([
      'appSlug',
      'evidenceUrl',
      'notes',
      'updatedAt',
    ]);
    expect(
      service.saveOwnership(
        'catalog-app',
        valid.website,
        'Updated supporting information for a future review.'
      )
    ).toBe(true);
    expect(service.data().ownership.length).toBe(1);
    expect(
      service.saveOwnership('bad/slug', valid.website, valid.description)
    ).toBe(false);
    expect(service.removeOwnership('catalog-app')).toBe(true);
    expect(createService().data().ownership).toEqual([]);
  });

  it('does not overwrite unreadable or malformed saved data', () => {
    for (const raw of [
      '{invalid',
      JSON.stringify({ version: 99 }),
      JSON.stringify({ version: 1, applications: [{}], ownership: [] }),
    ]) {
      localStorage.setItem(APPLICATION_DRAFT_STORAGE_KEY, raw);
      const service = createService();
      expect(service.error()).toBeTruthy();
      expect(service.saveApplication(valid)).toBeNull();
      expect(service.removeOwnership('example-app')).toBe(false);
      expect(localStorage.getItem(APPLICATION_DRAFT_STORAGE_KEY)).toBe(raw);
    }
  });

  it('does not report a successful save or change state when storage fails', () => {
    const service = createService({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    } as unknown as Storage);
    expect(service.saveApplication(valid)).toBeNull();
    expect(
      service.saveOwnership('example-app', valid.website, valid.description)
    ).toBe(false);
    expect(service.data().applications).toEqual([]);
    expect(service.data().ownership).toEqual([]);
    expect(service.error()).toContain('not saved');
    expect(createService(null).saveApplication(valid)).toBeNull();
  });

  it('reads the latest stored drafts before writing another draft', () => {
    const first = createService();
    const second = createService();
    first.saveApplication(valid);
    second.saveApplication({ ...valid, slug: 'another-app' });
    expect(createService().data().applications.length).toBe(2);
  });
});
