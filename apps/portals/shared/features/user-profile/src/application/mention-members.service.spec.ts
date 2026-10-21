import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { MENTION_MEMBERS, type MentionMember } from './mention-members.port';
import { MentionMembersService } from './mention-members.service';

const id = '00000000-0000-4000-8000-000000000001';
describe('privacy-aware mention member selection', () => {
  const port = { directory: jest.fn(), read: jest.fn() };
  let token: BehaviorSubject<string | null>;
  beforeEach(() => {
    jest.resetAllMocks();
    token = new BehaviorSubject<string | null>('author');
    port.directory.mockReturnValue(
      of(ok({ items: [{ id, name: 'Member' }], after: id }))
    );
    port.read.mockReturnValue(of(ok({ id, name: 'Member' })));
    TestBed.configureTestingModule({
      providers: [
        MentionMembersService,
        { provide: MENTION_MEMBERS, useValue: port },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
      ],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('loads no directory or profiles until requested, then replaces bounded pages', () => {
    const service = TestBed.inject(MentionMembersService);
    expect(port.directory).not.toHaveBeenCalled();
    expect(port.read).not.toHaveBeenCalled();
    service.browse();
    expect(service.items()).toEqual([{ id, name: 'Member' }]);
    port.directory.mockReturnValue(of(ok({ items: [], after: null })));
    service.browse(service.after());
    expect(port.directory).toHaveBeenLastCalledWith(id);
    expect(service.items()).toEqual([]);
  });
  it('clears names when access changes and distinguishes missing profiles from an outage', () => {
    const service = TestBed.inject(MentionMembersService);
    service.loadNames([id]);
    expect(service.names()[id]).toBe('Member');
    port.read.mockReturnValue(of(ok(null)));
    token.next('other');
    expect(service.names()).toEqual({});
    expect(service.namesError()).toBe('');
    port.read.mockReturnValue(of(err(new Error('Unavailable'))));
    service.loadNames([id]);
    expect(service.names()).toEqual({});
    expect(service.namesError()).toContain('could not be checked');
  });
  it('cancels old selections, page loads and profile lookups on a new session', () => {
    const pending = new Subject<Result<MentionMember | null, Error>>();
    const page = new Subject();
    port.read.mockReturnValueOnce(pending);
    port.directory.mockReturnValueOnce(page);
    const service = TestBed.inject(MentionMembersService);
    service.find(`/profiles/${id}`);
    service.browse();
    expect(pending.observed).toBe(true);
    expect(page.observed).toBe(true);
    token.next(null);
    expect(pending.observed).toBe(false);
    expect(page.observed).toBe(false);
    pending.next(ok({ id, name: 'Private old name' }));
    expect(service.match()).toBeNull();
    expect(service.items()).toEqual([]);
    expect(service.opened()).toBe(false);
  });
  it('checks only the public profile ID from a link, never a caller-supplied URL', () => {
    const service = TestBed.inject(MentionMembersService);
    service.find(`https://example.test/profiles/${id}`);
    expect(port.read).toHaveBeenCalledWith(id);
    expect(service.match()).toEqual({ id, name: 'Member' });
    service.find('https://example.test/private?credential=secret');
    expect(port.read).toHaveBeenCalledTimes(1);
    expect(service.match()).toBeNull();
    expect(service.findError()).toContain('profile page');
  });
  it('bounds selected member lookups before network access', () => {
    const service = TestBed.inject(MentionMembersService);
    expect(() => service.loadNames(Array(11).fill(id))).toThrow();
    expect(() => service.loadNames([id, id])).toThrow();
    expect(port.read).not.toHaveBeenCalled();
  });
});
