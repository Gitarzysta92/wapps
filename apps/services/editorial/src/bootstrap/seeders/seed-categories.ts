import { categories } from '@data';

export async function seedCategories(strapi: any) {
  console.log('🌱 Seeding categories...');

  // First pass: Create all categories without parent relationships
  const categoryMap = new Map<number, any>();

  // Create all parent categories first
  for (const category of categories) {
    const existing = await strapi.db
      .query('api::category.category')
      .findOne({ where: { slug: category.slug } });

    if (!existing) {
      const parent = await strapi.db.query('api::category.category').create({
        data: {
          name: category.name,
          slug: category.slug,
        },
      });
      categoryMap.set(category.id, parent);
      console.log(`  ✓ Created parent category: ${category.name}`);
    } else {
      categoryMap.set(category.id, existing);
      // Update if name changed
      await strapi.db.query('api::category.category').update({
        where: { id: existing.id },
        data: {
          name: category.name,
        },
      });
    }
  }

  // Second pass: Create all child categories with parent relationships
  for (const category of categories) {
    const parentRecord = categoryMap.get(category.id);

    if (category.childs && category.childs.length > 0) {
      for (const child of category.childs) {
        const existingChild = await strapi.db
          .query('api::category.category')
          .findOne({ where: { slug: child.slug } });

        if (!existingChild) {
          await strapi.db.query('api::category.category').create({
            data: {
              name: child.name,
              slug: child.slug,
              parentCategory: parentRecord.id,
            },
          });
          console.log(`  ✓ Created child category: ${child.name} (parent: ${category.name})`);
        } else {
          // Update if data changed
          await strapi.db.query('api::category.category').update({
            where: { id: existingChild.id },
            data: {
              name: child.name,
              parentCategory: parentRecord.id,
            },
          });
        }
      }
    }
  }

  console.log(`✅ Categories seeded (${categories.length} parent categories)`);
}
