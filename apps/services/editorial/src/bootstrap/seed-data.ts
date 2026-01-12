import { seedPlatforms } from './seeders/seed-platforms';
import { seedDevices } from './seeders/seed-devices';
import { seedMonetizationModels } from './seeders/seed-monetization-models';
import { seedSocials } from './seeders/seed-socials';
import { seedStores } from './seeders/seed-stores';
import { seedUserSpans } from './seeders/seed-user-spans';
import { seedTags } from './seeders/seed-tags';
import { seedCategories } from './seeders/seed-categories';

export async function seedData(strapi: any) {
  console.log('\n🌱 Starting data seeding process...\n');

  try {
    // Seed reference data first (no dependencies)
    await seedPlatforms(strapi);
    await seedDevices(strapi);
    await seedMonetizationModels(strapi);
    await seedSocials(strapi);
    await seedStores(strapi);
    await seedUserSpans(strapi);

    // Seed taxonomies
    await seedCategories(strapi);
    await seedTags(strapi);

    console.log('\n✅ Data seeding completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error during data seeding:', error);
    throw error;
  }
}
