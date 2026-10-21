import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ApplicationDiscussionsApiService } from './infrastructure/application-discussions-api.service';
import { APPLICATION_DISCUSSION_ORIGIN } from './application/application-discussions.port';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';

const applicationId = '10000000-0000-4000-8000-000000000001';
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
  votes: { upvotes: 0, downvotes: 0, mine: 0 },
};
const topic = {
  ...content,
  title: 'Real community discussion',
  tags: ['privacy'],
};
const thread = {
  id,
  revision: 1,
  replyCount: 0,
  comments: [comment],
  title: topic.title,
  tags: topic.tags,
  pinned: false,
  canPin: false,
};
const base = '/api/application-discussions/' + applicationId;

describe('application discussion HTTP boundary', () => {
  let api: ApplicationDiscussionsApiService,
    http: HttpTestingController,
    session: BehaviorSubject<string | null>;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApplicationDiscussionsApiService,
        { provide: APPLICATION_DISCUSSION_ORIGIN, useValue: '' },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: session, getToken: () => session.value },
        },
      ],
    });
    api = TestBed.inject(ApplicationDiscussionsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('sends desired pin state and validates exact accepted revision', async () => {
    const pending = firstValueFrom(
      api.change(
        { type: 'pin', applicationId, id, pinned: true, expectedRevision: 3 },
        'pin-key'
      )
    );
    const request = http.expectOne(base + '/' + id + '/pin');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Idempotency-Key')).toBe('pin-key');
    expect(request.request.body).toEqual({ pinned: true, expectedRevision: 3 });
    request.flush({ id, discussionId: id, revision: 4, projection: 'pending' });
    expect((await pending).ok).toBe(true);
  });
  it.each([{ pinned: 'true' }, { canPin: 1 }, { pinned: undefined }])(
    'refuses fabricated pin response metadata %j',
    async (fields) => {
      const pending = firstValueFrom(api.read(applicationId, id));
      http.expectOne(base + '/' + id).flush({ ...thread, ...fields });
      expect((await pending).ok).toBe(false);
    }
  );
  it('sends exact desired vote, revision and retry key and validates the accepted revision', async () => {
    const pending = firstValueFrom(
      api.change(
        { type: 'vote', applicationId, id, expectedRevision: 3, value: -1 },
        'same-vote'
      )
    );
    const request = http.expectOne(base + '/' + id + '/vote');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Idempotency-Key')).toBe('same-vote');
    expect(request.request.body).toEqual({ value: -1, expectedRevision: 3 });
    request.flush({ id, discussionId: id, revision: 4, projection: 'pending' });
    expect((await pending).ok).toBe(true);
    const replay = firstValueFrom(
      api.change(
        { type: 'vote', applicationId, id, expectedRevision: 3, value: -1 },
        'same-vote'
      )
    );
    http
      .expectOne(base + '/' + id + '/vote')
      .flush({ id, discussionId: id, revision: 5, projection: 'pending' });
    expect((await replay).ok).toBe(false);
  });
  it.each([
    undefined,
    { upvotes: 0, downvotes: 0, mine: 1 },
    { upvotes: 1, downvotes: 0, mine: 0, voterIdentityId: 'private' },
  ])(
    'rejects unknown, inconsistent or private vote metadata %j',
    async (votes) => {
      const pending = firstValueFrom(api.read(applicationId, id));
      http
        .expectOne(base + '/' + id)
        .flush({ ...thread, comments: [{ ...comment, votes }] });
      expect((await pending).ok).toBe(false);
    }
  );
  it('sends topic titles and tags on root edits, and keeps replies in their own schema', async () => {
    const pending = firstValueFrom(
      api.change(
        {
          type: 'edit',
          applicationId,
          id,
          root: true,
          content: topic,
          expectedRevision: 2,
        },
        'root-edit'
      )
    );
    const edit = http.expectOne(base + '/' + id);
    expect(edit.request.body).toEqual({ content: topic, expectedRevision: 2 });
    edit.flush({ id, discussionId: id, revision: 3, projection: 'pending' });
    expect((await pending).ok).toBe(true);
    const reply = firstValueFrom(
      api.change(
        { type: 'reply', applicationId, id, content: topic },
        'invalid-reply'
      )
    );
    expect((await reply).ok).toBe(false);
    http.expectNone(base + '/' + id + '/replies');
  });
  it('reads anonymous public content and keeps redacted ancestry without private account fields', async () => {
    session.next(null);
    const pending = firstValueFrom(api.read(applicationId, id));
    const removed = {
      ...comment,
      id: childId,
      parentId: id,
      depth: 1,
      content: null,
      createdAt: null,
      votes: null,
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
      const pending = firstValueFrom(api.read(applicationId, id));
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
    const pending = firstValueFrom(api.list(applicationId, null));
    http.expectOne(base).flush(input);
    expect((await pending).ok).toBe(false);
  });
  it('sends the original key, public text and exact expected revision', async () => {
    const pending = firstValueFrom(
      api.change(
        {
          type: 'edit',
          applicationId,
          id,
          root: false,
          content,
          expectedRevision: 3,
        },
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
        api.change({ type: 'create', applicationId, content: topic }, 'key')
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
        {
          type: 'edit',
          applicationId,
          id,
          root: false,
          content,
          expectedRevision: 3,
        },
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
        { type: 'create', applicationId, content: { ...topic, text: '' } },
        'key'
      )
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatchObject({ uncertain: false, status: 400 });
    http.expectNone(base);
  });
  it('rejects deferred writes created under a different session', async () => {
    const deferred = api.change(
      { type: 'create', applicationId, content: topic },
      'key'
    );
    session.next('bob');
    const result = await firstValueFrom(deferred);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatchObject({ uncertain: false, status: 401 });
    http.expectNone(base);
  });
});
