export type ProfileDto = {
  id: string;
  name: string;
  avatarUrl?: string;
  badges?: { id: string; name: string; icon?: string; color?: string }[];
}