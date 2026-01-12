import { socials } from '@data';

export async function seedSocials(strapi: any) {
  console.log('🌱 Seeding socials...');

  for (const social of socials) {
    const existing = await strapi.db
      .query('api::social.social')
      .findOne({ where: { externalId: social.id } });

    if (!existing) {
      await strapi.db.query('api::social.social').create({
        data: {
          externalId: social.id,
          name: social.name,
          slug: social.slug,
        },
      });
      console.log(`  ✓ Created social: ${social.name}`);
    } else {
      // Update if data has changed
      await strapi.db.query('api::social.social').update({
        where: { id: existing.id },
        data: {
          name: social.name,
          slug: social.slug,
        },
      });
      console.log(`  ↻ Updated social: ${social.name}`);
    }
  }

  console.log('✅ Socials seeded');
}
