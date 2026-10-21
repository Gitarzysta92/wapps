import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { PROFILE_SESSION } from './application/profile-session.port';
import { PROFILE_AVATAR } from './application/profile-avatar.port';
import { ProfileAvatarEditorService } from './application/profile-avatar-editor.service';
import { MyProfileService } from './application/my-profile.service';

describe('photo editor session and retry state', () => {
  function fixture() {
    const session = new BehaviorSubject<string | null>('alice');
    const response = new Subject<{ identityId: string; revision: number }>();
    const port = {
      change: jest.fn().mockReturnValue(response),
      clear: jest.fn(),
    };
    const profiles = {
      getMyProfile: jest
        .fn()
        .mockReturnValue({ id: 'Alice', revision: 2, joinedAt: new Date(1) }),
      reload: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        ProfileAvatarEditorService,
        {
          provide: PROFILE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
        { provide: PROFILE_AVATAR, useValue: port },
        { provide: MyProfileService, useValue: profiles },
      ],
    });
    return {
      session,
      response,
      port,
      profiles,
      editor: TestBed.inject(ProfileAvatarEditorService),
    };
  }
  afterEach(() => TestBed.resetTestingModule());
  it('clears selected files and unsubscribes in-flight work on session changes', () => {
    const f = fixture();
    f.editor.select(new File(['png'], 'my-photo.png', { type: 'image/png' }));
    f.editor.save();
    expect(f.editor.busy()).toBe(true);
    f.session.next('bob');
    expect(f.editor.selected()).toBe('');
    expect(f.editor.busy()).toBe(false);
    f.response.next({ identityId: 'Alice', revision: 3 });
    expect(f.profiles.reload).not.toHaveBeenCalled();
  });
  it('retains uncertain intent at its original revision and prevents concurrent commands', () => {
    const f = fixture();
    f.editor.remove();
    f.editor.remove();
    expect(f.port.change).toHaveBeenCalledTimes(1);
    f.response.error(new Error('Could not confirm'));
    f.profiles.getMyProfile.mockReturnValue({
      id: 'Alice',
      revision: 3,
      joinedAt: new Date(1),
    });
    f.port.change.mockReturnValue(new Subject());
    f.editor.remove();
    expect(f.port.change).toHaveBeenLastCalledWith('Alice', 2, null);
    expect(f.editor.selected()).toBe('Remove saved photo');
  });
  it('rejects unsupported files and clears previous selection before a save', () => {
    const f = fixture();
    f.editor.select(new File(['png'], 'ok.png', { type: 'image/png' }));
    f.editor.select(new File(['svg'], 'bad.svg', { type: 'image/svg+xml' }));
    f.editor.save();
    expect(f.editor.failed()).toBe(true);
    expect(f.port.change).not.toHaveBeenCalled();
  });
});
