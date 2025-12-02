import { ProfileDto } from '@domains/customer/profiles';

export const EXAMPLE_PROFILES: ProfileDto[] = [
  {
    id: "user-1",
    name: "Alice Johnson",
    avatarUrl: "https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png",
    badges: [
      { id: 'verified', name: 'verified', icon: '@tui.badge-check', color: 'primary' },
      { id: 'premium', name: 'premium', icon: '@tui.rocket', color: 'premium-soft' }
    ]
  },
  {
    id: "user-2",
    name: "Bob Smith",
    avatarUrl: "https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b8a66e64c0f6c1c8e1_Drawer%20Avatar%20Library%20example%202.png",
    badges: [
      { id: 'verified', name: 'verified', icon: '@tui.badge-check', color: 'primary' },
      { id: 'premium', name: 'premium', icon: '@tui.rocket', color: 'premium-soft' }
    ]
  },
  {
    id: "user-3",
    name: "Carol Williams",
    avatarUrl: "https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b8c9e77e4f8a8b9c2d_Drawer%20Avatar%20Library%20example%203.png",
    badges: [
      { id: 'verified', name: 'verified', icon: '@tui.badge-check', color: 'primary' },
      { id: 'premium', name: 'premium', icon: '@tui.rocket', color: 'premium-soft' }
    ]
  },
  {
    id: "user-4",
    name: "David Brown",
    avatarUrl: "https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b8d5e88f5e9c9d0e3f_Drawer%20Avatar%20Library%20example%204.png",
    badges: [
      { id: 'verified', name: 'verified', icon: '@tui.badge-check', color: 'primary' },
      { id: 'premium', name: 'premium', icon: '@tui.rocket', color: 'premium-soft' }
    ]
  },
  {
    id: "user-5",
    name: "Emma Davis",
    avatarUrl: "https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b8e6f99g6f0d0e1f4g_Drawer%20Avatar%20Library%20example%205.png",
    badges: [
      { id: 'verified', name: 'verified', icon: '@tui.badge-check', color: 'primary' },
      { id: 'premium', name: 'premium', icon: '@tui.rocket', color: 'premium-soft' }
    ]
  }
];

export const DEFAULT_PROFILE: ProfileDto = EXAMPLE_PROFILES[0];
export const MY_PROFILE: ProfileDto = EXAMPLE_PROFILES[0];

