import { MonetizationDto } from "@domains/catalog/pricing";

export const MONETIZATIONS: MonetizationDto[] = [
  { id: 0, name: "Free" },
  { id: 1, name: "Freemium" },
  { id: 2, name: "Subscription" },
  { id: 3, name: "Ad-based" },
  { id: 4, name: "One time purchase" },
  { id: 5, name: "Fees" }
];