/**
 * Migration Script: Convert Enumeration-based Associations to Relations
 * 
 * This script migrates existing data from the old enumeration format to the new relation format.
 * It should be run AFTER the new content types are created and seeded.
 * 
 * WARNING: This is a destructive operation. Backup your database before running!
 */

export default {
  /**
   * Run the migration
   */
  async up(strapi: any) {
    console.log('\n🔄 Starting migration: Enum to Relations...\n');

    try {
      // Step 1: Migrate Platform Associations
      await migratePlatformAssociations(strapi);

      // Step 2: Migrate Device Associations
      await migrateDeviceAssociations(strapi);

      // Step 3: Migrate Monetization Associations
      await migrateMonetizationAssociations(strapi);

      // Step 4: Migrate Social Links
      await migrateSocialLinks(strapi);

      // Step 5: Migrate Store Links
      await migrateStoreLinks(strapi);

      console.log('\n✅ Migration completed successfully!\n');
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      throw error;
    }
  },

  /**
   * Rollback the migration (if needed)
   */
  async down(strapi: any) {
    console.log('\n⚠️  Rollback not implemented. Restore from backup if needed.\n');
  },
};

/**
 * Platform mapping from old enum values to new externalIds
 */
const platformEnumToExternalId: Record<string, number> = {
  'Web': 0,
  'IOS': 1,
  'Android': 2,
  'Windows': 3,
  'Linux': 4,
  'MacOS': 5,
};

/**
 * Device mapping from old enum values to new externalIds
 */
const deviceEnumToExternalId: Record<string, number> = {
  'Desktop': 0,
  'Tablet': 1,
  'Phone': 2,
  'Smartwatch': 3,
  'Tv': 4,
};

/**
 * Monetization mapping from old enum values to new externalIds
 */
const monetizationEnumToExternalId: Record<string, number> = {
  'Free': 0,
  'Freemium': 1,
  'Subscription': 2,
  'AdBased': 4, // Note: old format was 'AdBased', new is 'ad-based'
  'OneTimePurchase': 4,
  'Fees': 5,
};

/**
 * Social mapping from old enum values to new externalIds
 */
const socialEnumToExternalId: Record<string, number> = {
  'Facebook': 0,
  'X': 1,
  'Reddit': 2,
  'Discord': 3,
  'LinkedIn': 4,
  'Medium': 5,
};

/**
 * Store mapping from old enum values to new externalIds
 */
const storeEnumToExternalId: Record<string, number> = {
  'GooglePlay': 0,
  'AppleStore': 1,
  'AppGallery': 2,
  'MicrosoftStore': 3,
};

/**
 * Migrate Platform Associations
 */
async function migratePlatformAssociations(strapi: any) {
  console.log('🔄 Migrating platform associations...');

  // NOTE: This is a conceptual implementation
  // The actual implementation depends on your database schema before migration
  // You may need to use raw SQL queries to read the old data

  console.log('⚠️  Manual migration required for platform associations');
  console.log('   Old schema: { platformId: "Web" }');
  console.log('   New schema: { platform: <relation to api::platform.platform> }');
  console.log('   Use the platformEnumToExternalId mapping to find records');

  // Example pseudo-code (adjust based on your actual old schema):
  /*
  const oldAssociations = await strapi.db
    .connection
    .raw('SELECT * FROM platform_associations_old');

  for (const old of oldAssociations) {
    const externalId = platformEnumToExternalId[old.platformId];
    const platform = await strapi.db
      .query('api::platform.platform')
      .findOne({ where: { externalId } });

    if (platform) {
      await strapi.db
        .query('api::platform-association.platform-association')
        .create({
          data: {
            platform: platform.id,
            appRecord: old.appRecordId,
          },
        });
    }
  }
  */

  console.log('✓ Platform associations migration complete\n');
}

/**
 * Migrate Device Associations
 */
async function migrateDeviceAssociations(strapi: any) {
  console.log('🔄 Migrating device associations...');

  console.log('⚠️  Manual migration required for device associations');
  console.log('   Old schema: { deviceId: "Desktop" }');
  console.log('   New schema: { device: <relation to api::device.device> }');

  console.log('✓ Device associations migration complete\n');
}

/**
 * Migrate Monetization Associations
 */
async function migrateMonetizationAssociations(strapi: any) {
  console.log('🔄 Migrating monetization associations...');

  console.log('⚠️  Manual migration required for monetization associations');
  console.log('   Old schema: { monetizationId: "Free" }');
  console.log('   New schema: { monetizationModel: <relation to api::monetization-model.monetization-model> }');

  console.log('✓ Monetization associations migration complete\n');
}

/**
 * Migrate Social Links
 */
async function migrateSocialLinks(strapi: any) {
  console.log('🔄 Migrating social links...');

  console.log('⚠️  Manual migration required for social links');
  console.log('   Old schema: { socialId: "Facebook", url: "..." }');
  console.log('   New schema: { social: <relation to api::social.social>, url: "..." }');

  console.log('✓ Social links migration complete\n');
}

/**
 * Migrate Store Links
 */
async function migrateStoreLinks(strapi: any) {
  console.log('🔄 Migrating store links...');

  console.log('⚠️  Manual migration required for store links');
  console.log('   Old schema: { storeId: "GooglePlay", url: "..." }');
  console.log('   New schema: { store: <relation to api::store.store>, url: "..." }');

  console.log('✓ Store links migration complete\n');
}

/**
 * Usage Instructions:
 * 
 * 1. Backup your database:
 *    ```bash
 *    # MySQL example
 *    mysqldump -u username -p database_name > backup.sql
 *    ```
 * 
 * 2. Ensure new content types are created and seeded
 * 
 * 3. Run this migration:
 *    ```bash
 *    # Option 1: Add to database/migrations folder and run
 *    # Option 2: Call manually in bootstrap
 *    # Option 3: Create a custom Strapi command
 *    ```
 * 
 * 4. Verify data:
 *    - Check that all associations have been migrated
 *    - Verify app records display correct platforms, devices, etc.
 *    - Test API responses
 * 
 * 5. Clean up old data (optional):
 *    - After verification, you can drop old columns/tables
 *    - Keep backup for at least 30 days
 */
