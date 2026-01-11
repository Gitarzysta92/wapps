# Database Migrations

This directory contains database migration files for schema changes.

## When to Create a Migration

Create a migration file when you need to:
- **Transform existing data** before schema changes
- **Rename fields/columns** (Strapi doesn't handle this automatically)
- **Make fields required** that are currently optional (need to populate data first)
- **Change field types** with data transformation
- **Populate default values** for existing records

## Migration File Naming

Use the format: `YYYY.MM.DDTHH.MM.SS.migration-name.js`

Example: `2026.01.10T13.50.19.add-new-field-to-app-record.js`

## Migration Template

```javascript
'use strict';

async function up(knex) {
  // Example: Add a new column with a default value for existing records
  const hasColumn = await knex.schema.hasColumn('app_records', 'new_field');
  
  if (!hasColumn) {
    await knex.schema.table('app_records', (table) => {
      table.string('new_field').defaultTo('default_value');
    });
    
    // Update existing records if needed
    await knex('app_records')
      .whereNull('new_field')
      .update({ new_field: 'default_value' });
  }
}

module.exports = { up };
```

## Important Notes

⚠️ **Experimental Feature**: Migrations are experimental in Strapi 5 and may change.

⚠️ **No Down Migrations**: Strapi doesn't support rollback. Plan carefully!

⚠️ **Table Deletions**: Strapi will delete unknown tables without warning.

✅ **Transactions**: Each migration runs in a transaction - if it fails, it's rolled back.

## Common Patterns

### Adding a Required Field (after populating data)
```javascript
async function up(knex) {
  // 1. Add column as nullable first
  await knex.schema.table('app_records', (table) => {
    table.string('required_field').nullable();
  });
  
  // 2. Populate existing records
  await knex('app_records')
    .whereNull('required_field')
    .update({ required_field: 'default_value' });
  
  // 3. Make it required (remove nullable) - this happens when you update schema.json
  // You still need to update the schema.json file after this migration
}
```

### Renaming a Field
```javascript
async function up(knex) {
  await knex.schema.table('app_records', (table) => {
    table.renameColumn('old_field_name', 'new_field_name');
  });
}
```

### Changing Field Type
```javascript
async function up(knex) {
  // 1. Add new column
  await knex.schema.table('app_records', (table) => {
    table.integer('new_integer_field');
  });
  
  // 2. Copy and transform data
  await knex.raw(`
    UPDATE app_records 
    SET new_integer_field = CAST(old_string_field AS INTEGER)
    WHERE old_string_field IS NOT NULL
  `);
  
  // 3. Drop old column (Strapi will handle this when schema is updated)
}
```
