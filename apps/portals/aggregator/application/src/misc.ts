import { CustomerProfileDto } from '@domains/customer/profiles';

export const GUEST_PROFILE: CustomerProfileDto = {
  id: 'guest',
  name: 'Guest',
  avatar: {
    uri: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
    alt: 'Guest Profile'
  }
}