import { ProfileAvatarEditorService } from './application/profile-avatar-editor.service';
import { PROFILE_AVATAR } from './application/profile-avatar.port';
import { ProfileAvatarApiService } from './infrastructure/profile-avatar-api.service';

export function provideProfileAvatarEditor() {
  return [
    ProfileAvatarEditorService,
    ProfileAvatarApiService,
    { provide: PROFILE_AVATAR, useExisting: ProfileAvatarApiService },
  ];
}
