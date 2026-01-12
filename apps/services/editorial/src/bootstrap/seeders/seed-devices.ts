import { devices } from '@data';

export async function seedDevices(strapi: any) {
  console.log('🌱 Seeding devices...');

  for (const device of devices) {
    const existing = await strapi.db
      .query('api::device.device')
      .findOne({ where: { externalId: device.id } });

    if (!existing) {
      await strapi.db.query('api::device.device').create({
        data: {
          externalId: device.id,
          name: device.name,
          slug: device.slug,
        },
      });
      console.log(`  ✓ Created device: ${device.name}`);
    } else {
      // Update if data has changed
      await strapi.db.query('api::device.device').update({
        where: { id: existing.id },
        data: {
          name: device.name,
          slug: device.slug,
        },
      });
      console.log(`  ↻ Updated device: ${device.name}`);
    }
  }

  console.log('✅ Devices seeded');
}
