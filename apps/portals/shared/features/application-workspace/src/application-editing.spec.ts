import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  ApplicationDraft,
  ApplicationDraftReceipt,
  ApplicationEditingSource,
} from '@domains/catalog/record';
import { ApplicationEditingService } from './application/application-editing.service';
import {
  APPLICATION_EDITING,
  type ApplicationEditingPort,
} from './application/application-ownership.port';
import {
  APPLICATION_DRAFTS,
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
  type ApplicationDraftsPort,
} from './application/application-drafts.port';

const applicationId = '019a0010-0000-7000-8000-000000000001';
const id = '019a0010-0000-7000-8000-000000000002';
const claimId = '019a0010-0000-7000-8000-000000000003';
const fields = {
  name: 'Private title',
  slug: 'example',
  website: 'https://example.test',
  description: 'Private work that must survive canonical conflicts.',
};
const editing = { applicationId, claimId, sourcePublicationRevision: 3 };
const draft: ApplicationDraft = {
  id,
  ...fields,
  editing,
  revision: 4,
  createdAt: 10,
  updatedAt: 20,
  images: { logo: null, banner: null },
};
const canonical: ApplicationEditingSource = {
  ...editing,
  sourcePublicationRevision: 5,
  images: { logo: null, banner: null },
  fields: {
    ...fields,
    name: 'Canonical title',
    description: 'Current canonical content with an independent staff edit.',
  },
};
const receipt: ApplicationDraftReceipt = { id, revision: 5, deleted: false };
describe('verified-owner editing state', () => {
  let session: BehaviorSubject<string | null>;
  let port: jest.Mocked<ApplicationEditingPort>;
  let drafts: jest.Mocked<ApplicationDraftsPort>;
  let service: ApplicationEditingService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      source: jest.fn().mockReturnValue(of(ok(canonical))),
      edit: jest.fn().mockReturnValue(of(ok(receipt))),
    };
    drafts = {
      read: jest.fn().mockReturnValue(of(ok(draft))),
      list: jest.fn().mockReturnValue(of(ok([draft]))),
      change: jest.fn().mockReturnValue(of(ok(receipt))),
    };
    TestBed.configureTestingModule({
      providers: [
        ApplicationEditingService,
        { provide: APPLICATION_EDITING, useValue: port },
        { provide: APPLICATION_DRAFTS, useValue: drafts },
        {
          provide: APPLICATION_WORKSPACE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ApplicationEditingService);
  });
  it('retains private fields when canonical content is newer', () => {
    service.open(applicationId, id);
    expect(service.fields()).toEqual(fields);
    expect(service.sourceChanged()).toBe(true);
    service.setField(
      'description',
      'Unsaved private text must remain present during refresh.'
    );
    service.refreshSource();
    expect(service.fields().description).toContain('Unsaved private');
  });
  it('separates private save from explicit merged-content recovery', () => {
    service.open(applicationId, id);
    service.save().subscribe();
    expect(drafts.change.mock.calls[0][0]).toEqual({
      type: 'update',
      id,
      expectedRevision: 4,
      fields,
    });
    expect(port.edit).not.toHaveBeenCalled();
    service.useCanonical('name');
    service.save(true).subscribe();
    expect(port.edit.mock.calls[0][0]).toEqual({
      type: 'rebase',
      id,
      expectedRevision: 4,
      editing: { ...editing, sourcePublicationRevision: 5 },
      fields: { ...fields, name: 'Canonical title' },
      imageChoices: { logo: 'draft', banner: 'draft' },
    });
    expect(service.feedback()).toContain('Pending review was cancelled');
  });
  it('opens a fresh editing draft from canonical data when the active grant has no draft', () => {
    drafts.list.mockReturnValue(of(ok([])));
    service.open(applicationId);
    service.save().subscribe();
    expect(port.edit.mock.calls[0][0]).toEqual({
      type: 'open',
      id: null,
      expectedRevision: null,
      editing: { ...editing, sourcePublicationRevision: 5 },
      fields: canonical.fields,
    });
  });
  it('carries explicit per-slot choices into the exact merged intent and resets them when the source refreshes', () => {
    service.open(applicationId, id);
    service.chooseImage('logo', 'canonical');
    service.save(true).subscribe();
    expect(port.edit.mock.calls[0][0].imageChoices).toEqual({
      logo: 'canonical',
      banner: 'draft',
    });
    service.refreshSource();
    expect(service.imageChoices()).toEqual({ logo: 'draft', banner: 'draft' });
  });
  it('preserves unsaved verified-owner text after image attachment but refuses an intervening revision', () => {
    service.open(applicationId, id);
    service.setField('name', 'Unsaved owner text');
    drafts.read.mockReturnValue(of(ok({ ...draft, revision: 5 })));
    service.acceptImageChange({ id, revision: 5, deleted: false });
    expect(service.draft()?.revision).toBe(5);
    expect(service.fields().name).toBe('Unsaved owner text');
    service.acceptImageChange({ id, revision: 5, deleted: false });
    expect(service.error()).toBe('');
    drafts.read.mockReturnValue(
      of(ok({ ...draft, revision: 7, name: 'Other owner edit' }))
    );
    service.acceptImageChange({ id, revision: 6, deleted: false });
    expect(service.draft()?.revision).toBe(5);
    expect(service.fields().name).toBe('Unsaved owner text');
    expect(service.error()).toContain('changed during the image request');
  });
  it('refuses merging unknown image snapshots', () => {
    port.source.mockReturnValue(of(ok({ ...canonical, images: undefined })));
    service.open(applicationId, id);
    service.save(true).subscribe();
    expect(port.edit).not.toHaveBeenCalled();
    expect(service.error()).toContain('image information');
  });
  it('reopens the active-grant draft but never adopts an obsolete grant', () => {
    service.open(applicationId);
    expect(service.draft()?.id).toBe(id);
    port.source.mockReturnValue(
      of(ok({ ...canonical, claimId: applicationId }))
    );
    service.open(applicationId);
    expect(service.draft()).toBeNull();
    expect(service.fields()).toEqual(canonical.fields);
    service.open(applicationId, id);
    expect(service.grantChanged()).toBe(true);
    service.save(true).subscribe();
    expect(port.edit).not.toHaveBeenCalled();
    expect(service.error()).toContain('new ownership grant');
  });
  it('retains private access when the ownership source is unavailable and refuses canonical merging', () => {
    port.source.mockReturnValue(of(err(new Error('Grant not found'))));
    service.open(applicationId, id);
    expect(service.fields()).toEqual(fields);
    expect(service.source()).toBeNull();
    service.save().subscribe();
    expect(drafts.change).toHaveBeenCalledTimes(1);
    service.save(true).subscribe();
    expect(port.edit).not.toHaveBeenCalled();
  });
  it('rejects a private draft belonging to another application', () => {
    drafts.read.mockReturnValue(
      of(ok({ ...draft, editing: { ...editing, applicationId: id } }))
    );
    service.open(applicationId, id);
    expect(service.draft()).toBeNull();
    expect(service.source()).toBeNull();
    expect(service.error()).toContain('requested application');
  });
  it('retries the same merged payload and key after an uncertain response', () => {
    port.edit.mockReturnValueOnce(
      of(err(new ApplicationDraftRequestError(true, 'unknown')))
    );
    service.open(applicationId, id);
    service.save(true).subscribe();
    const attempt = port.edit.mock.calls[0];
    service.setField('name', 'Unrelated new text');
    expect(service.fields().name).toBe(fields.name);
    service.retry().subscribe();
    expect(port.edit.mock.calls[1]).toEqual(attempt);
  });
  it('cancels late account responses and forgets the old editing/retry state', () => {
    const response = new Subject<Result<ApplicationDraftReceipt, Error>>();
    port.edit.mockReturnValue(response);
    service.open(applicationId, id);
    service.save(true).subscribe();
    session.next('bob');
    response.next(ok(receipt));
    expect(service.draft()).toBeNull();
    expect(service.source()).toBeNull();
    expect(service.fields().name).toBe('');
    expect(service.feedback()).toBe('');
    expect(service.uncertain()).toBe(false);
    service.retry().subscribe();
    expect(port.edit).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    'returns the original application after a cross-route retry (merge: %s)',
    (merge) => {
      const failure = of(
        err(new ApplicationDraftRequestError(true, 'unknown'))
      );
      if (merge) port.edit.mockReturnValueOnce(failure);
      else drafts.change.mockReturnValueOnce(failure);
      service.open(applicationId, id);
      service.save(merge).subscribe();
      port.source.mockReturnValue(
        of(ok({ ...canonical, applicationId: claimId }))
      );
      drafts.list.mockReturnValue(of(ok([])));
      service.open(claimId);
      service.retry().subscribe((result) => {
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.applicationId).toBe(applicationId);
      });
      const calls = merge ? port.edit.mock.calls : drafts.change.mock.calls;
      expect(calls[1]).toEqual(calls[0]);
    }
  );
  it('refuses a save prepared before an account switch', () => {
    service.open(applicationId, id);
    const operation = service.save(true);
    session.next('bob');
    operation.subscribe();
    expect(port.edit).not.toHaveBeenCalled();
  });
  it('ignores a source response superseded by another application route', () => {
    const response = new Subject<Result<ApplicationEditingSource, Error>>();
    port.source.mockReturnValueOnce(response);
    service.open(applicationId, id);
    port.source.mockReturnValue(of(err(new Error('missing'))));
    drafts.list.mockReturnValue(of(ok([])));
    service.open(id);
    response.next(ok(canonical));
    response.complete();
    expect(service.source()).toBeNull();
    expect(service.draft()).toBeNull();
  });
});
