import { stores } from '@data';

export async function seedStores(strapi: any) {
  console.log('🌱 Seeding stores...');

  for (const store of stores) {
    const existing = await strapi.db
      .query('api::store.store')
      .findOne({ where: { externalId: store.id } });

    if (!existing) {
      await strapi.db.query('api::store.store').create({
        data: {
          externalId: store.id,
          name: store.name,
          slug: store.slug,
        },
      });
      console.log(`  ✓ Created store: ${store.name}`);
    } else {
      // Update if data has changed
      await strapi.db.query('api::store.store').update({
        where: { id: existing.id },
        data: {
          name: store.name,
          slug: store.slug,
        },
      });
      console.log(`  ↻ Updated store: ${store.name}`);
    }
  }

  console.log('✅ Stores seeded');
}
