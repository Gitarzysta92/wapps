import { CustomerProfileDto } from '../models/profile.dto';

export interface IMyProfileEventListener {
  profileUpdated(profile: CustomerProfileDto): void;
}
