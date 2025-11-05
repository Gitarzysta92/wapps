import { DeviceOptionDto } from "@domains/catalog/compatibility";
import { DEVICES } from "./devices";
import { generateSlug } from "@domains/catalog/record";

export const DEVICE_OPTIONS: DeviceOptionDto[] = DEVICES.map(d => ({
  id: d.id,
  name: d.name,
  slug: generateSlug(d.name)
}));

