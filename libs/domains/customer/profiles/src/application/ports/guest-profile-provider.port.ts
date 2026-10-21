import { GuestProfileDto } from '../models/guest-profile.dto';

export interface IGuestProfileProvider {
  getGuestProfile(): GuestProfileDto;
}
