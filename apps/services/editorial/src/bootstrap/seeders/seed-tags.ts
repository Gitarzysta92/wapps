import { tags } from '@data';

export async function seedTags(strapi: any) {
  console.log('🌱 Seeding tags...');

  for (const tag of tags) {
    const existing = await strapi.db
      .query('api::tag.tag')
      .findOne({ where: { slug: tag.slug } });

    if (!existing) {
      await strapi.db.query('api::tag.tag').create({
        data: {
          name: tag.name,
          slug: tag.slug,
        },
      });
      console.log(`  ✓ Created tag: ${tag.name}`);
    } else {
      // Update if data has changed
      await strapi.db.query('api::tag.tag').update({
        where: { id: existing.id },
        data: {
          name: tag.name,
        },
      });
    }
  }

  console.log(`✅ Tags seeded (${tags.length} tags)`);
}
