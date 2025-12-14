export type CustomerProfileDto = {
  id: string;
  name: string;
  avatar?: { uri: string; alt: string };
  badges?: { id: string; name: string; icon?: string; color?: string }[];
}