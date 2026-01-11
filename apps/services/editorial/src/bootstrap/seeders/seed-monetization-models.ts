import { monetizationModels } from '@data';

export async function seedMonetizationModels(strapi: any) {
  console.log('🌱 Seeding monetization models...');

  for (const model of monetizationModels) {
    const existing = await strapi.db
      .query('api::monetization-model.monetization-model')
      .findOne({ where: { externalId: model.id } });

    if (!existing) {
      await strapi.db.query('api::monetization-model.monetization-model').create({
        data: {
          externalId: model.id,
          name: model.name,
          slug: model.slug,
        },
      });
      console.log(`  ✓ Created monetization model: ${model.name}`);
    } else {
      // Update if data has changed
      await strapi.db.query('api::monetization-model.monetization-model').update({
        where: { id: existing.id },
        data: {
          name: model.name,
          slug: model.slug,
        },
      });
      console.log(`  ↻ Updated monetization model: ${model.name}`);
    }
  }

  console.log('✅ Monetization models seeded');
}
