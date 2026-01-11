import { platforms } from '@data';

export async function seedPlatforms(strapi: any) {
  console.log('🌱 Seeding platforms...');

  for (const platform of platforms) {
    const existing = await strapi.db
      .query('api::platform.platform')
      .findOne({ where: { externalId: platform.id } });

    if (!existing) {
      await strapi.db.query('api::platform.platform').create({
        data: {
          externalId: platform.id,
          name: platform.name,
          slug: platform.slug,
        },
      });
      console.log(`  ✓ Created platform: ${platform.name}`);
    } else {
      // Update if data has changed
      await strapi.db.query('api::platform.platform').update({
        where: { id: existing.id },
        data: {
          name: platform.name,
          slug: platform.slug,
        },
      });
      console.log(`  ↻ Updated platform: ${platform.name}`);
    }
  }

  console.log('✅ Platforms seeded');
}
