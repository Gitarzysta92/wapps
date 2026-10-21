import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { PublicApplicationDiscussion, PublicApplicationDiscussionPage } from '@domains/community';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { ApplicationDiscussionsService } from './application/application-discussions.service';
import {
  APPLICATION_DISCUSSIONS,
  DiscussionRequestError,
  type ApplicationDiscussionsPort,
  type ApplicationDiscussionReceipt,
} from './application/application-discussions.port';

const applicationId = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const other = '10000000-0000-4000-8000-000000000003';
const content = { displayName: 'Public Alice', text: 'A considered post.' };
const topic = { ...content, title: 'A useful topic', tags: ['privacy'] };
const thread: PublicApplicationDiscussion = {
  id,
  title: topic.title,
  tags: topic.tags,
  pinned: false,
  canPin: false,
  revision: 1,
  replyCount: 0,
  comments: [
    {
      id,
      parentId: null,
      depth: 0,
      content,
      createdAt: 1,
      updatedAt: null,
      editable: true,
      removable: true,
    },
  ],
};
const receipt: ApplicationDiscussionReceipt = {
  id,
  discussionId: id,
  revision: 1,
  projection: 'pending',
};

describe('application discussion state', () => {
  let port: jest.Mocked<ApplicationDiscussionsPort>,
    session: BehaviorSubject<string | null>,
    service: ApplicationDiscussionsService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      list: jest.fn().mockReturnValue(of(ok({ items: [thread], next: null }))),
      read: jest.fn().mockReturnValue(of(ok(thread))),
      change: jest.fn().mockReturnValue(of(ok(receipt))),
    };
    TestBed.configureTestingModule({
      providers: [
        ApplicationDiscussionsService,
        { provide: APPLICATION_DISCUSSIONS, useValue: port },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: session, getToken: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ApplicationDiscussionsService);
  });
  it('retains an immutable exact retry across route destruction and never carries it into another account', () => {
    port.change.mockReturnValue(
      of(err(new DiscussionRequestError('Unconfirmed', true)))
    );
    const injector = createEnvironmentInjector(
      [ApplicationDiscussionsService],
      TestBed.inject(EnvironmentInjector)
    );
    const routed = injector.get(ApplicationDiscussionsService);
    routed.open(applicationId);
    const input = { ...topic, tags: [...topic.tags] };
    routed.change({ type: 'create', applicationId, content: input });
    input.text = 'Changed after dispatch';
    input.tags.push('changed');
    const original = port.change.mock.calls[0];
    injector.destroy();
    service.open(other);
    expect(service.pending()?.command).toMatchObject({ content: topic });
    service.change({ type: 'create', applicationId: other, content: topic });
    expect(port.change).toHaveBeenCalledTimes(1);
    service.retry();
    expect(port.change.mock.calls[1]).toEqual(original);
    session.next('bob');
    expect(service.pending()).toBeNull();
    service.retry();
    expect(port.change).toHaveBeenCalledTimes(2);
  });
  it('reports acceptance separately from a delayed projection', () => {
    service.open(applicationId);
    port.list.mockReturnValue(of(err(new Error('Public view still updating'))));
    service.change({ type: 'create', applicationId, content: topic });
    expect(service.completed()).toBe(1);
    expect(service.pending()).toBeNull();
    expect(service.accepted()).toEqual(receipt);
    expect(service.feedback()).toContain('still be updating');
    expect(service.error()).toContain('still updating');
    expect(service.items()).toEqual([]);
  });
  it('retries the exact vote without resetting the post composer on acceptance', () => {
    service.open(applicationId, id);
    port.change.mockReturnValueOnce(
      of(err(new DiscussionRequestError('Unconfirmed vote', true)))
    );
    service.change({
      type: 'vote',
      applicationId,
      id,
      expectedRevision: 1,
      value: -1,
    });
    const original = port.change.mock.calls[0];
    expect(service.pending()?.command).toEqual({
      type: 'vote',
      applicationId,
      id,
      expectedRevision: 1,
      value: -1,
    });
    service.retry();
    expect(port.change.mock.calls[1]).toEqual(original);
    expect(service.completed()).toBe(0);
    expect(service.pending()).toBeNull();
    expect(service.feedback()).toContain('saved');
  });
  it('retries the original pin and preserves composer state while clearing session-private intent', () => {
    service.open(applicationId, id);
    port.change.mockReturnValueOnce(
      of(err(new DiscussionRequestError('Unconfirmed pin', true)))
    );
    service.change({
      type: 'pin',
      applicationId,
      id,
      expectedRevision: 1,
      pinned: true,
    });
    const original = port.change.mock.calls[0];
    service.retry();
    expect(port.change.mock.calls[1]).toEqual(original);
    expect(service.completed()).toBe(0);
    port.change.mockReturnValueOnce(
      of(err(new DiscussionRequestError('Unconfirmed pin', true)))
    );
    service.change({
      type: 'pin',
      applicationId,
      id,
      expectedRevision: 2,
      pinned: false,
    });
    session.next('other-admin');
    expect(service.pending()).toBeNull();
    expect(service.accepted()).toBeNull();
  });
  it('clears definite conflicts without reporting a completed change', () => {
    port.change.mockReturnValue(
      of(err(new DiscussionRequestError('Reload discussion', false, 409)))
    );
    service.open(applicationId, id);
    service.change({
      type: 'edit',
      applicationId,
      id,
      root: true,
      content: topic,
      expectedRevision: 1,
    });
    expect(service.pending()).toBeNull();
    expect(service.completed()).toBe(0);
    expect(service.error()).toBe('Reload discussion');
  });
  it('fences late public reads and receipts on session change', () => {
    const late = new Subject<Result<PublicApplicationDiscussion, Error>>();
    const write = new Subject<Result<ApplicationDiscussionReceipt, Error>>();
    port.read.mockReturnValueOnce(late);
    port.change.mockReturnValue(write);
    service.open(applicationId, id);
    service.change({ type: 'reply', applicationId, id, content });
    port.read.mockReturnValue(
      of(err(new DiscussionRequestError('Not found', false, 404)))
    );
    session.next(null);
    late.next(ok(thread));
    write.next(ok(receipt));
    expect(service.items()).toEqual([]);
    expect(service.completed()).toBe(0);
    expect(service.saving()).toBe(false);
    expect(service.pending()).toBeNull();
    expect(service.missing()).toBe(true);
  });
  it('fences route changes, leaves in-flight intent recoverable and resets pagination', () => {
    const late = new Subject<Result<PublicApplicationDiscussionPage, Error>>();
    const write = new Subject<Result<ApplicationDiscussionReceipt, Error>>();
    port.list.mockReturnValueOnce(late);
    port.change.mockReturnValue(write);
    service.open(applicationId);
    service.change({ type: 'create', applicationId, content: topic });
    port.list.mockReturnValue(of(ok({ items: [thread], next: `1.${id}` })));
    service.open(other);
    late.next(ok({ items: [], next: null }));
    write.next(ok(receipt));
    expect(service.items()).toHaveLength(1);
    expect(service.pending()).not.toBeNull();
    expect(service.saving()).toBe(false);
    expect(service.feedback()).toBe('');
    service.older();
    expect(port.list).toHaveBeenLastCalledWith(other, `1.${id}`);
    service.reload(true);
    expect(port.list).toHaveBeenLastCalledWith(other, null);
    service.open(null);
    expect(service.items()).toEqual([]);
  });
  it('validates schemas and the current application before writing, and never writes anonymously', () => {
    service.open(applicationId);
    service.change({
      type: 'create',
      applicationId,
      content: { ...topic, title: '' },
    });
    service.change({ type: 'create', applicationId: other, content: topic });
    service.change({ type: 'reply', applicationId, id, content: topic });
    service.change({
      type: 'edit',
      applicationId,
      id,
      root: true,
      content,
      expectedRevision: 1,
    });
    expect(port.change).not.toHaveBeenCalled();
    session.next(null);
    service.change({ type: 'create', applicationId, content: topic });
    expect(port.change).not.toHaveBeenCalled();
  });
});
