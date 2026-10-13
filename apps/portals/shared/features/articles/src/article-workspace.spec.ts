import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  ArticleDraft,
  ArticleFields,
  ArticlePublicationStatus,
} from '@domains/publication/article';
import { ArticleWorkspaceService } from './application/article-workspace.service';
import {
  ARTICLE_SESSION,
  ARTICLE_WORKSPACE,
  ArticleRequestError,
  type ArticleWorkspacePort,
  type ArticleChangeReceipt,
} from './application/article-workspace.port';

const id = '10000000-0000-4000-8000-000000000001',
  second = '10000000-0000-4000-8000-000000000002';
const fields: ArticleFields = {
  title: 'Article',
  slug: 'article',
  excerpt: 'Summary.',
  byline: 'Public author',
  category: 'Guides',
  tags: [],
  sections: [{ heading: '', paragraphs: ['Content.'] }],
};
const draft: ArticleDraft = {
  ...fields,
  id,
  revision: 2,
  createdAt: 100,
  updatedAt: 100,
};
const status: ArticlePublicationStatus = {
  id,
  revision: 2,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  publicSlug: null,
  visible: false,
  latestSubmission: null,
};
const submitted: ArticlePublicationStatus = {
  ...status,
  latestSubmission: {
    ...fields,
    submittedRevision: 1,
    sourcePublicationRevision: null,
    submittedAt: 100,
    reviewedAt: null,
    status: 'submitted',
    reason: '',
  },
};
describe('article workspace session and command state', () => {
  let session: BehaviorSubject<string | null>,
    port: jest.Mocked<ArticleWorkspacePort>,
    service: ArticleWorkspaceService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      list: jest.fn().mockReturnValue(of(ok([draft]))),
      read: jest.fn().mockReturnValue(of(ok(draft))),
      status: jest.fn().mockReturnValue(of(ok(status))),
      reviews: jest
        .fn()
        .mockReturnValue(of(ok({ items: [submitted], page: 1, total: 1 }))),
      change: jest
        .fn()
        .mockReturnValue(of(ok({ id, revision: 3, deleted: false }))),
    };
    TestBed.configureTestingModule({
      providers: [
        ArticleWorkspaceService,
        { provide: ARTICLE_WORKSPACE, useValue: port },
        {
          provide: ARTICLE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ArticleWorkspaceService);
  });
  it('keeps unsaved fields after a definite conflict and requires saved content for submission', () => {
    service.open({ view: 'edit', id });
    service.setField('title', 'Changed');
    service.publish('submit');
    expect(port.change).not.toHaveBeenCalled();
    expect(service.error()).toContain('Save your changes');
    port.change.mockReturnValue(
      of(err(new ArticleRequestError('Changed elsewhere', false, 409)))
    );
    service.save();
    expect(service.fields().title).toBe('Changed');
    expect(service.uncertain()).toBe(false);
    expect(service.error()).toBe('Changed elsewhere');
  });
  it('does not compose commands from mismatched private/status revisions', () => {
    port.status.mockReturnValue(of(ok({ ...status, revision: 3 })));
    service.open({ view: 'edit', id });
    service.save();
    service.publish('submit');
    expect(port.change).not.toHaveBeenCalled();
    expect(service.draft()).toBeNull();
  });
  it('preserves separators while typing tags and saves their normalized values', () => {
    service.open({ view: 'edit', id });
    service.setTags('tools, ');
    expect(service.tagsText()).toBe('tools, ');
    service.setTags(service.tagsText() + 'guides');
    port.change.mockReturnValue(
      of(err(new ArticleRequestError('Unconfirmed', true)))
    );
    service.save();
    expect(port.change.mock.calls[0][0]).toMatchObject({
      input: { tags: ['tools', 'guides'] },
    });
    service.setTags('ignored');
    expect(service.tagsText()).toBe('tools, guides');
    session.next('bob');
    expect(service.tagsText()).toBe('');
  });
  it('submits the saved revision and reviews only the frozen pending version', () => {
    service.open({ view: 'edit', id });
    service.publish('submit');
    expect(port.change.mock.calls[0][0]).toEqual({
      kind: 'publication',
      id,
      action: 'submit',
      input: {
        expectedRevision: 2,
        expectedPublicationRevision: null,
        submittedRevision: null,
        reason: '',
      },
    });
    port.status.mockReturnValue(of(ok(submitted)));
    service.open({ view: 'review', id });
    service.publish('reject');
    expect(port.change).toHaveBeenCalledTimes(1);
    service.publish('reject', 'Needs evidence.');
    expect(port.change.mock.calls[1][0]).toMatchObject({
      kind: 'publication',
      action: 'reject',
      input: { submittedRevision: 1, reason: 'Needs evidence.' },
    });
  });
  it('retains the exact uncertain command and key across navigation, then refreshes the visible list', () => {
    port.change.mockReturnValue(
      of(err(new ArticleRequestError('Unconfirmed', true)))
    );
    service.open({ view: 'edit', id });
    service.setField('title', 'Retried text');
    service.save();
    const first = port.change.mock.calls[0];
    expect(service.uncertain()).toBe(true);
    service.open({ view: 'list' });
    service.save();
    expect(port.change).toHaveBeenCalledTimes(1);
    port.change.mockReturnValue(of(ok({ id, revision: 3, deleted: false })));
    const reads = port.list.mock.calls.length;
    service.retry();
    expect(port.change.mock.calls[1]).toEqual(first);
    expect(port.list).toHaveBeenCalledTimes(reads + 1);
    expect(service.uncertain()).toBe(false);
  });
  it('does not replace another editor after a late successful write', () => {
    const pending = new Subject<Result<ArticleChangeReceipt, Error>>();
    port.change.mockReturnValue(pending);
    service.open({ view: 'edit', id });
    service.save();
    port.read.mockReturnValue(
      of(ok({ ...draft, id: second, title: 'Other draft' }))
    );
    port.status.mockReturnValue(of(ok({ ...status, id: second })));
    service.open({ view: 'edit', id: second });
    pending.next(ok({ id, revision: 3, deleted: false }));
    pending.complete();
    expect(service.draft()?.id).toBe(second);
    expect(service.fields().title).toBe('Other draft');
    expect(service.result()?.id).toBe(id);
  });
  it('fences late reads and writes on account change and forgets old retry intent', () => {
    const pending = new Subject<Result<ArticleChangeReceipt, Error>>();
    port.change.mockReturnValue(pending);
    service.open({ view: 'edit', id });
    service.save();
    session.next('bob');
    pending.next(ok({ id, revision: 3, deleted: false }));
    pending.complete();
    service.retry();
    expect(port.change).toHaveBeenCalledTimes(1);
    expect(service.result()).toBeNull();
    expect(service.fields().title).toBe('');
    expect(service.uncertain()).toBe(false);
    const late = new Subject<Result<ArticleDraft, Error>>();
    port.read.mockReturnValue(late);
    service.open({ view: 'edit', id });
    session.next(null);
    late.next(ok(draft));
    late.complete();
    expect(service.draft()).toBeNull();
    expect(service.signedIn()).toBe(false);
  });
  it('cancels old route reads and bounds sections and paragraphs', () => {
    const late = new Subject<Result<ArticleDraft, Error>>();
    port.read.mockReturnValue(late);
    service.open({ view: 'edit', id });
    service.open({ view: 'new' });
    late.next(ok(draft));
    late.complete();
    expect(service.draft()).toBeNull();
    service.removeSection(0);
    service.removeParagraph(0, 0);
    expect(service.fields().sections).toHaveLength(1);
    expect(service.fields().sections[0].paragraphs).toHaveLength(1);
    for (let i = 0; i < 40; i++) {
      service.addSection();
      service.addParagraph(0);
    }
    expect(service.fields().sections).toHaveLength(30);
    expect(service.fields().sections[0].paragraphs).toHaveLength(16);
  });
  it('rejects private deletion before withdrawal and public URL changes', () => {
    port.status.mockReturnValue(
      of(
        ok({
          ...status,
          publicSlug: fields.slug,
          publicationRevision: 1,
          publishedSubmissionRevision: 1,
          visible: true,
        })
      )
    );
    service.open({ view: 'edit', id });
    service.remove();
    expect(port.change).not.toHaveBeenCalled();
    service.setField('slug', 'renamed');
    service.save();
    expect(port.change).not.toHaveBeenCalled();
    expect(service.error()).toContain('cannot be renamed');
  });
  it('does not create duplicate articles after successful creation and refuses anonymous commands', () => {
    service.open({ view: 'new' });
    for (const [key, value] of Object.entries(fields))
      service.setField(key as keyof ArticleFields, value);
    port.change.mockReturnValue(of(ok({ id, revision: 1, deleted: false })));
    service.save();
    service.save();
    expect(port.change).toHaveBeenCalledTimes(1);
    expect(service.createdHere()).toBe(true);
    session.next(null);
    service.open({ view: 'new' });
    service.save();
    expect(port.change).toHaveBeenCalledTimes(1);
  });
});
