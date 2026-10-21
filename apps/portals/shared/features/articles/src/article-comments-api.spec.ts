import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ArticleCommentsApiService } from './infrastructure/article-comments-api.service';
import {
  ARTICLE_ORIGIN,
  ARTICLE_SESSION,
} from './application/article-workspace.port';

const articleId = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const childId = '10000000-0000-4000-8000-000000000003';
const content = {
  displayName: 'Public name',
  text: '<script>Plain text</script>',
};
const comment = {
  id,
  parentId: null,
  depth: 0,
  content,
  createdAt: 1,
  updatedAt: null,
  editable: false,
  removable: false,
};
const thread = { id, revision: 1, replyCount: 0, comments: [comment] };
const base = '/api/article-comments/' + articleId;

describe('article comment HTTP boundary', () => {
  let api: ArticleCommentsApiService,
    http: HttpTestingController,
    session: BehaviorSubject<string | null>;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ArticleCommentsApiService,
        { provide: ARTICLE_ORIGIN, useValue: '' },
        {
          provide: ARTICLE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    api = TestBed.inject(ArticleCommentsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('reads anonymous public content and keeps redacted ancestry without private account fields', async () => {
    session.next(null);
    const pending = firstValueFrom(api.read(articleId, id));
    const removed = {
      ...comment,
      id: childId,
      parentId: id,
      depth: 1,
      content: null,
      createdAt: null,
    };
    http
      .expectOne(base + '/' + id)
      .flush({ ...thread, replyCount: 1, comments: [comment, removed] });
    const result = await pending;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.comments[1].content).toBeNull();
  });
  it.each([
    { ...thread, comments: [{ ...comment, ownerIdentityId: 'private' }] },
    { ...thread, comments: [{ ...comment, content: null, createdAt: null }] },
    { ...thread, comments: [{ ...comment, createdAt: null }] },
    {
      ...thread,
      comments: [comment, { ...comment, id: childId, parentId: id, depth: 2 }],
    },
    { ...thread, comments: [comment, comment] },
  ])(
    'rejects malformed or identity-bearing public thread responses',
    async (input) => {
      const pending = firstValueFrom(api.read(articleId, id));
      http.expectOne(base + '/' + id).flush(input);
      expect((await pending).ok).toBe(false);
    }
  );
  it.each([
    { items: [thread, thread], next: null },
    { items: [thread], next: 'invalid' },
    { items: [thread], next: `1.${id}` },
    {
      items: [
        {
          ...thread,
          comments: [
            comment,
            { ...comment, id: childId, parentId: id, depth: 1 },
          ],
        },
      ],
      next: null,
    },
  ])('rejects invalid bounded listing responses', async (input) => {
    const pending = firstValueFrom(api.list(articleId, null));
    http.expectOne(base).flush(input);
    expect((await pending).ok).toBe(false);
  });
  it('sends the original key, public text and exact expected revision', async () => {
    const pending = firstValueFrom(
      api.change(
        { type: 'edit', articleId, id, content, expectedRevision: 3 },
        'same-key'
      )
    );
    const request = http.expectOne(base + '/' + id);
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Idempotency-Key')).toBe('same-key');
    expect(request.request.body).toEqual({ content, expectedRevision: 3 });
    request.flush({ id, discussionId: id, revision: 4, projection: 'pending' });
    expect((await pending).ok).toBe(true);
  });
  it.each([400, 401, 403, 404, 409, 500, 503])(
    'classifies HTTP %s without inventing success',
    async (status) => {
      const pending = firstValueFrom(
        api.change({ type: 'create', articleId, content }, 'key')
      );
      http.expectOne(base).flush({}, { status, statusText: 'Failure' });
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error).toMatchObject({
          uncertain: status >= 500,
          status,
        });
    }
  );
  it('retains uncertainty when a successful receipt is corrupt', async () => {
    const pending = firstValueFrom(
      api.change(
        { type: 'edit', articleId, id, content, expectedRevision: 3 },
        'key'
      )
    );
    http
      .expectOne(base + '/' + id)
      .flush({ id, discussionId: id, revision: 3, projection: 'pending' });
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ uncertain: true });
  });
  it('rejects local invalid input definitively before sending a mutation', async () => {
    const result = await firstValueFrom(
      api.change(
        { type: 'create', articleId, content: { ...content, text: '' } },
        'key'
      )
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatchObject({ uncertain: false, status: 400 });
    http.expectNone(base);
  });
  it('rejects deferred writes created under a different session', async () => {
    const deferred = api.change({ type: 'create', articleId, content }, 'key');
    session.next('bob');
    const result = await firstValueFrom(deferred);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatchObject({ uncertain: false, status: 401 });
    http.expectNone(base);
  });
});
