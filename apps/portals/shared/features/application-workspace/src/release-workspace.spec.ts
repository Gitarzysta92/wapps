import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  ReleaseDraft,
  ReleaseFields,
  ReleasePublicationStatus,
  ReleaseSource,
} from '@domains/catalog/versioning';
import { ReleaseWorkspaceService } from './application/release-workspace.service';
import { APPLICATION_WORKSPACE_SESSION } from './application/application-drafts.port';
import {
  RELEASE_WORKSPACE,
  ReleaseRequestError,
  type ReleaseWorkspacePort,
  type ReleaseChangeReceipt,
} from './application/release-workspace.port';

const id = '019a0010-0000-7000-8000-000000000001';
const applicationId = '019a0010-0000-7000-8000-000000000002';
const releaseId = '019a0010-0000-7000-8000-000000000003';
const claimId = '019a0010-0000-7000-8000-000000000004';
const fields: ReleaseFields = {
  version: '1.0.0',
  title: 'First release',
  description: 'Available now.',
  channel: 'stable',
  type: 'major',
  releasedOn: '2026-01-01',
  changes: [{ type: 'feature', description: 'Create a workspace.' }],
};
const draft: ReleaseDraft = {
  ...fields,
  id,
  target: {
    applicationId,
    releaseId,
    claimId,
    sourcePublicationRevision: null,
  },
  revision: 2,
  createdAt: Date.UTC(2026, 0, 1),
  updatedAt: Date.UTC(2026, 0, 1),
};
const status: ReleasePublicationStatus = {
  id,
  revision: 2,
  publicationRevision: null,
  publicVersion: null,
  publishedSubmissionRevision: null,
  latestSubmission: null,
};
const source: ReleaseSource = {
  applicationId,
  claimId,
  applicationName: 'Example',
  release: null,
};
const submitted: ReleasePublicationStatus = {
  ...status,
  latestSubmission: {
    ...fields,
    target: draft.target,
    status: 'submitted',
    submittedRevision: 1,
    submittedAt: Date.UTC(2026, 0, 1),
    reviewedAt: null,
    reason: '',
  },
};

describe('release workflow state', () => {
  let session: BehaviorSubject<string | null>;
  let port: jest.Mocked<ReleaseWorkspacePort>;
  let service: ReleaseWorkspaceService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      list: jest
        .fn<ReturnType<ReleaseWorkspacePort['list']>, []>()
        .mockReturnValue(of(ok([draft]))),
      read: jest
        .fn<ReturnType<ReleaseWorkspacePort['read']>, [string]>()
        .mockReturnValue(of(ok(draft))),
      status: jest
        .fn<ReturnType<ReleaseWorkspacePort['status']>, [string, boolean]>()
        .mockReturnValue(of(ok(status))),
      source: jest
        .fn<
          ReturnType<ReleaseWorkspacePort['source']>,
          [string, string | null]
        >()
        .mockReturnValue(of(ok(source))),
      reviews: jest
        .fn<ReturnType<ReleaseWorkspacePort['reviews']>, [number]>()
        .mockReturnValue(of(ok({ items: [submitted], page: 1, total: 1 }))),
      change: jest
        .fn<
          ReturnType<ReleaseWorkspacePort['change']>,
          Parameters<ReleaseWorkspacePort['change']>
        >()
        .mockReturnValue(of(ok({ id, revision: 3, deleted: false }))),
    };
    TestBed.configureTestingModule({
      providers: [
        ReleaseWorkspaceService,
        { provide: RELEASE_WORKSPACE, useValue: port },
        {
          provide: APPLICATION_WORKSPACE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ReleaseWorkspaceService);
  });
  it('creates only against the current verified application source', () => {
    service.open({ view: 'new', applicationId });
    service.fields.set(fields);
    service.save();
    expect(port.change.mock.calls[0][0]).toEqual({
      kind: 'draft',
      type: 'create',
      input: { applicationId, claimId, fields },
    });
  });
  it('does not create without a source or on a failed source read', () => {
    port.source.mockReturnValue(of(err(new Error('Grant revoked'))));
    service.open({ view: 'new', applicationId });
    service.fields.set(fields);
    service.save();
    expect(port.change).not.toHaveBeenCalled();
    expect(service.sourceError()).toContain('revoked');
  });
  it('refuses mismatched private revisions before loading an editor', () => {
    port.status.mockReturnValue(of(ok({ ...status, revision: 3 })));
    service.open({ view: 'edit', id });
    expect(service.draft()).toBeNull();
    expect(service.status()).toBeNull();
    expect(service.error()).toContain('changed while loading');
  });
  it('retains exact uncertain update fields and key across navigation', () => {
    port.change.mockReturnValue(
      of(err(new ReleaseRequestError('Lost response', true)))
    );
    service.open({ view: 'edit', id });
    service.setField('title', 'Chosen release');
    service.save();
    const [command, key] = port.change.mock.calls[0];
    service.open({ view: 'new', applicationId });
    service.setField('title', 'Different intent');
    service.save();
    expect(port.change).toHaveBeenCalledTimes(1);
    service.retry();
    expect(port.change.mock.calls[1]).toEqual([command, key]);
    expect(service.uncertain()).toBe(true);
  });
  it('finishes feature-owned writes after navigation without replacing another editor', () => {
    const write = new Subject<Result<ReleaseChangeReceipt, Error>>();
    port.change.mockReturnValue(write);
    service.open({ view: 'edit', id });
    service.save();
    service.open({ view: 'new', applicationId });
    write.next(ok({ id, revision: 3, deleted: false }));
    write.complete();
    expect(service.draft()).toBeNull();
    expect(service.source()?.applicationId).toBe(applicationId);
    expect(service.result()?.id).toBe(id);
    expect(service.saving()).toBe(false);
  });
  it('clears pending writes and ignores late success after an account change', () => {
    const write = new Subject<Result<ReleaseChangeReceipt, Error>>();
    port.change.mockReturnValue(write);
    service.open({ view: 'edit', id });
    service.save();
    session.next('bob');
    write.next(ok({ id, revision: 3, deleted: false }));
    write.complete();
    service.retry();
    expect(port.change).toHaveBeenCalledTimes(1);
    expect(service.draft()).toBeNull();
    expect(service.result()).toBeNull();
    expect(service.feedback()).toBe('');
    expect(service.uncertain()).toBe(false);
  });
  it('refreshes a visible list after a write finishes following navigation', () => {
    const write = new Subject<Result<ReleaseChangeReceipt, Error>>();
    port.change.mockReturnValue(write);
    port.list.mockReturnValue(of(ok([])));
    service.open({ view: 'new', applicationId });
    service.fields.set(fields);
    service.save();
    service.open({ view: 'list' });
    expect(service.items()).toEqual([]);
    port.list.mockReturnValue(of(ok([draft])));
    write.next(ok({ id, revision: 1, deleted: false }));
    write.complete();
    expect(service.items()).toEqual([draft]);
    expect(service.result()?.id).toBe(id);
    expect(service.feedback()).toContain('saved');
  });
  it('fences stale reads on navigation and session changes', () => {
    const read = new Subject<Result<ReleaseDraft, Error>>();
    port.read.mockReturnValue(read);
    service.open({ view: 'edit', id });
    session.next(null);
    read.next(ok(draft));
    read.complete();
    expect(service.draft()).toBeNull();
    expect(service.signedIn()).toBe(false);
    service.open({ view: 'list' });
    expect(port.list).not.toHaveBeenCalled();
  });
  it('does not submit unsaved fields and uses both revisions for saved submission', () => {
    service.open({ view: 'edit', id });
    service.setField('title', 'Unsaved');
    service.publish('submit');
    expect(port.change).not.toHaveBeenCalled();
    service.setField('title', fields.title);
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
  });
  it('accepts a future private date but does not submit it early', () => {
    port.read.mockReturnValue(of(ok({ ...draft, releasedOn: '9999-01-01' })));
    service.open({ view: 'edit', id });
    service.publish('submit');
    expect(port.change).not.toHaveBeenCalled();
    expect(service.error()).toContain('release date');
  });
  it('requires a rejection reason and binds review to the frozen submission', () => {
    port.status.mockReturnValue(of(ok(submitted)));
    service.open({ view: 'review', id });
    service.publish('reject');
    expect(port.change).not.toHaveBeenCalled();
    service.publish('reject', 'Please describe the breaking change.');
    expect(port.change.mock.calls[0][0]).toEqual({
      kind: 'publication',
      id,
      action: 'reject',
      input: {
        expectedRevision: 2,
        expectedPublicationRevision: null,
        submittedRevision: 1,
        reason: 'Please describe the breaking change.',
      },
    });
    expect(service.draft()).toBeNull();
  });
  it('does not approve a stale publication revision', () => {
    port.status.mockReturnValue(
      of(ok({ ...submitted, publicationRevision: 5 }))
    );
    service.open({ view: 'review', id });
    service.publish('approve');
    expect(port.change).not.toHaveBeenCalled();
    expect(service.error()).toContain('Rebase');
  });
  it('refreshes canonical notes without destroying unsaved choices, then merges explicitly', () => {
    const canonical = {
      ...fields,
      id: releaseId,
      revision: 7,
      visible: true,
      title: 'Canonical title',
    };
    port.source.mockReturnValue(of(ok({ ...source, release: canonical })));
    port.status.mockReturnValue(
      of(ok({ ...status, publicationRevision: 7, publicVersion: '1.0.0' }))
    );
    service.open({ view: 'edit', id });
    service.setField('description', 'Retained unsaved description');
    service.refreshSource();
    expect(port.source).toHaveBeenCalledWith(applicationId, releaseId);
    expect(service.fields().description).toBe('Retained unsaved description');
    service.useCanonical('title');
    service.rebase();
    expect(port.change.mock.calls[0][0]).toEqual({
      kind: 'draft',
      type: 'rebase',
      id,
      input: {
        expectedRevision: 2,
        expectedPublicationRevision: 7,
        fields: {
          ...fields,
          title: 'Canonical title',
          description: 'Retained unsaved description',
        },
      },
    });
  });
  it('refuses to rebase under a replacement grant but leaves private saving available', () => {
    port.source.mockReturnValue(of(ok({ ...source, claimId: releaseId })));
    service.open({ view: 'edit', id });
    service.refreshSource();
    service.rebase();
    expect(service.mayRebase()).toBe(false);
    expect(port.change).not.toHaveBeenCalled();
    service.save();
    expect(port.change).toHaveBeenCalledTimes(1);
  });
  it('opens reviewed notes as a separate draft at the selected public revision', () => {
    port.source.mockReturnValue(
      of(
        ok({
          ...source,
          release: { ...fields, id: releaseId, revision: 7, visible: true },
        })
      )
    );
    service.open({ view: 'new', applicationId, releaseId });
    service.openCanonical();
    expect(port.change.mock.calls[0][0]).toEqual({
      kind: 'draft',
      type: 'open',
      input: {
        applicationId,
        releaseId,
        claimId,
        expectedPublicationRevision: 7,
      },
    });
  });
  it('retains unsaved fields on a definitive conflict and allows explicit reload', () => {
    port.change.mockReturnValue(
      of(err(new ReleaseRequestError('Conflict', false, 409)))
    );
    service.open({ view: 'edit', id });
    service.setField('title', 'Keep this');
    service.save();
    expect(service.fields().title).toBe('Keep this');
    expect(service.uncertain()).toBe(false);
    service.reload();
    expect(service.fields().title).toBe(fields.title);
  });
  it('bounds review pagination before calling the provider', () => {
    service.open({ view: 'queue', page: NaN });
    expect(port.reviews).not.toHaveBeenCalled();
    service.open({ view: 'queue', page: 2 });
    expect(port.reviews).toHaveBeenCalledWith(2);
  });
});
