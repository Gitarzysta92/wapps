import { userSpans } from '@data';

export async function seedUserSpans(strapi: any) {
  console.log('🌱 Seeding user spans...');

  for (const span of userSpans) {
    const existing = await strapi.db
      .query('api::user-span.user-span')
      .findOne({ where: { externalId: span.id } });

    if (!existing) {
      await strapi.db.query('api::user-span.user-span').create({
        data: {
          externalId: span.id,
          name: span.name,
          slug: span.slug,
          from: span.from,
          to: span.to,
        },
      });
      console.log(`  ✓ Created user span: ${span.name}`);
    } else {
      // Update if data has changed
      await strapi.db.query('api::user-span.user-span').update({
        where: { id: existing.id },
        data: {
          name: span.name,
          slug: span.slug,
          from: span.from,
          to: span.to,
        },
      });
      console.log(`  ↻ Updated user span: ${span.name}`);
    }
  }

  console.log('✅ User spans seeded');
}
